const sha256 = require("sha256");
const mysql = require("mysql");
const UIDGenerator = require("uid-generator");
const uidgen = new UIDGenerator();
const mailSender = require("./email_verification");

require("custom-env").env("db");

let userTokens = [];
let verCodes = [];

const TOKEN_TIMEOUT_MS = 1000 * 60 * 60 * 24;
const ERR_USER_EXIST = "User does not exist or incorrect password.";
const ERR_INVALID_EMAIL = "Invalid email address.";
const ERR_EMAIL_IN_USE = "Email already in use.";
const ERR_USER_NOT_VER = "User not verified.";
const ERR_TOKEN_EXPIRED = "User token expired.";
const ERR_INVALID_TOKEN = "Invalid token.";
const ERR_USER_NOT_IN_GROUP = "User is not in a group.";
const ERR_USER_IN_GROUP = "User is already in group.";
const ERR_GROUP_DOES_NOT_EXIST = "Group does not exist.";
const ERR_GROUP_FULL = "Group is full.";
const ERR_NO_VER_CODE = "No such verification code. You may need to sign in again and resend the verification link.";

class Token {
	constructor(id, token) {
		this.id = id;
		this.token = token;
		this.time = Date.now();
	}
}

class VerificationCode {
	constructor(id) {
		this.id = id;
		this.code = uidgen.generateSync();
	}
}

/*
--------------------Account Management & Login------------------------------
*/

let db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DATABASE,
	port: process.env.PORT,
	ssl: Boolean(process.env.SSL),
});

db.connect(function (err) {
	if (err) {
		console.error("DB error:");
		console.error(err);
	} else {
		console.log("db setup");
	}
});

let heartbeat = setInterval(function () {
	db.query("SELECT 1", function (err) {
		if (err) {
			console.error(err.message);
		}
	});
}, 60000);

db.on("error", function () {
	db = mysql.createConnection({
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: process.env.DATABASE,
		port: process.env.PORT,
		ssl: true,
	});
});

async function addToken(userID) {
	return new Promise(function (resolve, reject) {
		for (let i = 0; i < userTokens.length; i++) {
			let token = userTokens[i];
			if (token.id == userID) {
				uidgen.generate().then(function (uid) {
					userTokens[i] = new Token(userID, uid);
					resolve(userTokens[i]);
				});
				return;
			}
		}
		uidgen.generate().then(function (uid) {
			let t = new Token(userID, uid);
			userTokens.push(t);
			resolve(t);
		});
	});
}

async function register(UserName, UserEmail, UserPassword) {
	const pass = sha256(makeSaltString(UserPassword, UserEmail));

	return new Promise(function (resolve, reject) {
		if (UserEmail.substring(UserEmail.length - 6) !== ".ac.uk") {
			console.log(`Invalid email: ${UserEmail}`);
			resolve({ success: false, error: ERR_INVALID_EMAIL });
			return;
		}

		checkSql = "SELECT * FROM user_data WHERE UserEmail=?";

		db.query(checkSql, [UserEmail], function (err, row) {
			if (err) {
				resolve({ success: false, error: err.message });
				return console.error(err.message);
			}

			if (row.length > 0) {
				resolve({ success: false, error: ERR_EMAIL_IN_USE });
				return;
			}

			const insertSql = `INSERT INTO user_data (UserName, UserEmail, UserPassword) VALUES (?, ?, ?)`;
			db.query(insertSql, [UserName, UserEmail, pass], function (err, row) {
				if (err) {
					resolve({ success: false, error: err.message });
					return console.error(err.message);
				}
				console.log("added", UserName);
				const getUserID = "SELECT UserId FROM user_data WHERE UserEmail=?";
				db.query(getUserID, [UserEmail], function (err, row) {
					if (err) {
						resolve({ success: false, error: err });
						return;
					}
					if (row.length === 0) {
						resolve({ success: false, error: ERR_USER_EXIST });
						return;
					}
					generateVerificationCode(row[0].UserId, UserEmail);
					resolve({ success: true });
				});
			});
		});
	});
}

async function login(UserEmail, UserPassword) {
	const pass = sha256(makeSaltString(UserPassword, UserEmail));
    console.log(pass);
	const sql = `SELECT UserId, UserName, UserVerified, GroupId FROM user_data WHERE UserEmail=? AND UserPassword=?`;
	return new Promise(function (resolve, reject) {
		db.query(sql, [UserEmail, pass], function (err, row) {
			if (err) {
				resolve({success: false, error: err});
                return;
			}

            console.log(row);

			if (row.length === 0) {
				resolve({ success: false, error: ERR_USER_EXIST });
				return;
			}

			let data = row[0];
			addToken(data.UserId).then(function (token) {
				data.tokenData = {
					token: token.token,
					expire: token.time + TOKEN_TIMEOUT_MS,
				};
				data.success = true;
				resolve(data);
			});
		});
	});
}

async function verifyToken(userID, givenToken) {
	return new Promise(function (resolve, reject) {
		for (let i = 0; i < userTokens.length; i++) {
			let token = userTokens[i];
			if (token.id.toString() === userID && givenToken === token.token) {
				if (Date.now() > token.time + TOKEN_TIMEOUT_MS) {
					resolve({ success: false, error: ERR_TOKEN_EXPIRED });

					userTokens.splice(i, 1);
					return;
				}
				userTokens[i].time = Date.now() + TOKEN_TIMEOUT_MS;
				resolve({ success: true });
				return;
			}
		}
		resolve({ success: false, error: ERR_INVALID_TOKEN });
	});
}

async function isUserVerified(userID) {
	const sql = `SELECT UserVerified FROM user_data WHERE UserId=?`;
	return new Promise(function (resolve, reject) {
		db.query(sql, [userID], function (err, row) {
			if (err) {
				return console.error(err.message);
			}

			if (row.length === 0) {
				resolve({ success: false, error: ERR_USER_EXIST });
				return;
			}
			if (row[0].UserVerified === 0) {
				resolve({ success: false, error: ERR_USER_NOT_VER });
				return;
			}
			resolve({ success: true });
		});
	});
}

async function resendVerification(userID) {
	return new Promise(function (resolve, reject) {
		let found = false;
		for (let i = 0; i < verCodes.length; i++) {
			if (verCodes[i].id === userID) {
				verCodes.splice(userID, 1);
			}
		}
		let sql = "SELECT UserEmail FROM user_data WHERE UserId=?";
		db.query(sql, [userID], function (err, row) {
			if (row.length === 0) {
				resolve({ success: false, ERR_USER_EXIST });
			}

			generateVerificationCode(userID, row[0].UserEmail);
		});
	});
}

function generateVerificationCode(userID, UserEmail) {
	let found = false;
	let code = new VerificationCode(userID);
	verCodes.map(function (val, index) {
		if (val.id === userID) {
			verCodes[index] = code;
			found = true;
		}
	});
	if (!found) {
		verCodes.push(code);
	}
	mailSender.sendMail(UserEmail, code.code);
}

async function verifyUser(code) {
	return new Promise(function (resolve, reject) {
		let found = false;
		for (let i = 0; i < verCodes.length; i++) {
			if (verCodes[i].code === code) {
				found = true;
				const sql = "UPDATE user_data SET UserVerified = 1 WHERE UserId=?";
				db.query(sql, [verCodes[i].id], function (err, row) {
					if (err) {
						resolve({ success: false, error: err.message });
						return;
					}
					resolve({ success: true });
				});
			}
		}
		if (!found) {
			resolve({ success: false, error: ERR_NO_VER_CODE });
		}
	});
}

/*
--------------------User/Group Data------------------------------
*/

async function getUserData(userID) {
	let data = {};
	return new Promise(function (resolve, reject) {
		const userSql = `
        SELECT user_data.UserId, user_data.UserName, user_data.UserEmail, 
        user_data.GroupId, user_data.SendContactInfo
        FROM user_data
        WHERE UserId=?
        `;
		db.query(userSql, [userID], function (err, row) {
			if (err) {
				resolve({ success: false, error: ERR_USER_EXIST });
				return console.error(err.message);
			}

			if (row.length === 0) {
				resolve({ success: false, error: ERR_USER_EXIST });
				return;
			}

			data = row[0];

			if (data.GroupId == null) {
				data.success = true;
				resolve(data);
				return;
			}

			getGroupMembers((groupID = data.GroupId), null).then(function (members) {
				data.group = members.data;
				if (data.GroupId == null) {
					data.success = true;
					resolve(data);
					return;
				}
				let getCodeSql = "SELECT Code FROM user_groups WHERE GroupId=?";
				db.query(getCodeSql, [data.GroupId], function (err, row) {
					if (err) {
						resolve({ success: false, error: err.message });
					}
					data.success = true;
					if (row.length === 0) {
						resolve(data);
						return true;
					}
					data.Code = row[0].Code;
					resolve(data);
				});
			});
		});
	});
}

async function getGroupMembers(groupID = null, groupCode = null) {
	return new Promise(function (resolve, reject) {
		if ((groupCode === groupID) == null) {
			resolve({ success: false, error: "no parameters" });
			return;
		}

		let groupSql;
		let input;
		if (groupCode != null) {
			input = groupCode;
			groupSql = `
            SELECT user_data.UserId, user_data.UserName, user_data.UserEmail
            FROM user_groups
            INNER JOIN user_data
            ON user_groups.GroupId = user_data.GroupId
            WHERE user_groups.Code = ?
            `;
		} else {
			input = groupID;
			groupSql = `
            SELECT user_data.UserId, user_data.UserName, user_data.UserEmail
            FROM user_groups
            INNER JOIN user_data
            ON user_groups.GroupId = user_data.GroupId
            WHERE user_groups.GroupId = ?
            `;
		}

		db.query(groupSql, [input], function (err, rows) {
			if (err) {
				resolve({ success: false, error: err.message });
				return console.error(err.message);
			}

			resolve({ success: true, data: rows });
		});
	});
}

async function removeUserFromGroup(userID) {
	return new Promise(function (resolve, reject) {
		getUserData(userID).then(function (data) {
			if (data.success === false) {
				resolve(data);
				return;
			}

			if (data.GroupId == null) {
				resolve({ success: true });
				return;
			}

			const removeUserSql = `UPDATE user_data SET GroupId=NULL WHERE UserId=?`;
			db.query(removeUserSql, [userID], function (err) {
				if (err) {
					resolve({ success: false, error: err });
					return;
				}

				resolve({ success: true });

				// Clear groups with no members
				if (data.group.length === 1) {
					let removeSql = `DELETE FROM user_groups WHERE user_groups.GroupId=?`;
					db.query(removeSql, [data.GroupId], function (err) {
						if (err) {
							console.error(err);
						}
					});
				}
			});
		});
	});
}

async function addGroup(userID) {
	let groupCode = uidgen.generateSync();

	return new Promise(function (resolve, reject) {
		let sql = `INSERT INTO user_groups (Code) VALUES (?)`;
		db.query(sql, [groupCode], function (err) {
			if (err) {
				resolve({ success: false, error: err });
				return console.error(err);
			}

			joinGroup(userID, groupCode).then(function (data) {
				data.code = groupCode;
				resolve(data);
			});
		});
	});
}

async function joinGroup(userID, groupCode) {
	return new Promise(function (resolve, reject) {
		let groupExistsSql = "SELECT * FROM user_groups WHERE code=?";
		db.query(groupExistsSql, [groupCode], function (err, res) {
			if (err) {
				resolve({ success: false, error: err });
				return;
			}
			if (res.length === 0) {
				resolve({ success: false, error: ERR_GROUP_DOES_NOT_EXIST });
				return;
			}

			getGroupMembers(null, groupCode).then(function (res) {
				if (res.success === false) {
					resolve(data);
					return;
				}

				if (res.data.length >= 4) {
					resolve({ success: false, error: ERR_GROUP_FULL });
					return;
				}
				for (let i = 0; i < res.data.length; i++) {
					if (res.data[i].UserId === userID) {
						resolve({ success: false, error: ERR_USER_IN_GROUP });
						return;
					}
				}

				removeUserFromGroup(userID).then(function (data) {
					if (data.success === false) {
						resolve(data);
						return;
					}

					const getGroupIDSql = "SELECT GroupId FROM user_groups WHERE Code=?";

					db.query(getGroupIDSql, [groupCode], function (err, row) {
						if (err) {
							resolve({ success: false, error: err });
							return;
						}

						if (row.length === 0) {
							resolve({ success: false, error: ERR_GROUP_DOES_NOT_EXIST });
							return;
						}

						const updateUserSql =
							"UPDATE user_data SET GroupId=? WHERE UserId=?";
						db.query(updateUserSql, [row[0].GroupId, userID], function (err) {
							if (err) {
								console.error(err);
								return;
							}

							resolve({ success: true });
						});
					});
				});
			});
		});
	});
}

async function removeUser(userID) {
	return new Promise(function (resolve, reject) {
		getUserData(userID).then(function (data) {
			if (data.success === false) {
				resolve(data);
				return;
			}

			removeUserFromGroup(userID).then(function (data) {
				const sql = `DELETE FROM user_data WHERE UserId=?;`;
				db.query(sql, [userID], function (err) {
					if (err) {
						resolve({ success: false, error: err.message });
						return;
					}
					resolve({ success: true });
				});
			});
		});
	});
}

async function changeSendContact(userID, val) {
	return new Promise((resolve, reject) => {
		const sql = `UPDATE user_data SET SendContactInfo=? WHERE UserId=?`;
		db.query(sql, [val, userID], (err) => {
            if(err){
                resolve({success: false, error: err.message});
                return;
            }
            resolve({success: true});
        });
	});
}

function makeSaltString(password, email) {
	return email.substring(0, 5) + password + email.substring(0, 5);
}

module.exports.login = login;
module.exports.verifyToken = verifyToken;
module.exports.isUserVerified = isUserVerified;
module.exports.generateVerificationCode = generateVerificationCode;
module.exports.register = register;
module.exports.getUserData = getUserData;
module.exports.joinGroup = joinGroup;
module.exports.removeUserFromGroup = removeUserFromGroup;
module.exports.addGroup = addGroup;
module.exports.removeUser = removeUser;
module.exports.verifyUser = verifyUser;
module.exports.resendVerification = resendVerification;
module.exports.changeSendContact = changeSendContact;
