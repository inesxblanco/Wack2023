const express = require("express");
const fs = require("fs");
const db = require("./database_function");
const emailValidator = require("email-validator");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const locks = require("locks");
require("custom-env").env("db");

const allowedChars = "abcdefghijklmnopqrstuvwxyz0123456789@.- ";

const app = express();

const databaseLock = locks.createMutex();

app.use(
	fileUpload({
		createParentPath: true,
		limits: {
			fileSize: 100 * 1024 * 1024 * 1024, //10MB max file(s) size
		},
	})
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("frontend"));

app.use("/", function (req, res, next) {
	if (req.body.email) {
		req.body.email = req.body.email.toLowerCase();
	}

	next();
});

app.get("/", function (req, res, next) {
	fs.readFile("./frontend/main.html", "utf8", function (err, data) {
		if (err) {
			console.error(err.message);
			return;
		}
		res.send(data);
	});
});

app.post("/register", function (req, res, next) {
	const email = req.body.email;
	const password = req.body.password;
	const name = req.body.name;

	if (name === null || password === null || email === null) {
		res.send({ success: false, error: "invalid inputs" });
		return;
	}

	if (emailValidator.validate(email) === false) {
		res.send({ success: false, error: "invalid email" });
		return;
	}

	//Email checked on validation - no need to escape escape!! AHHHHHHHHHH - Gemma
	db.register(name, email, password).then(function (data) {
		res.send(data);
	});
});

app.post("/login", function (req, res, next) {
	const email = req.body.email;
	const password = req.body.password;

	if (emailValidator.validate(email) === false) {
		res.send({ success: false, error: "invalid email" });
		return;
	}

	databaseLock.lock(() => {
		db.login(email, password)
			.then(function (data) {
				res.send(data);
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.get("/verify/", function (req, res, next) {
	const code = req.query.code;

	databaseLock.lock(() => {
		db.verifyUser(code)
			.then(function (data) {
				if (data.success) {
					res.redirect("/profile.html");
				} else {
					res.send(data);
				}
			})
			.catch((err) => {
				res.send({ success: false, message: err.message });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

// ----------------- API -------------------

app.use("/api/", function (req, res, next) {
	const userID = req.body.userID;
	const token = req.body.token;

	if (userID == null || token == null) {
		res.send("Invalid inputs in body");
		return;
	}
	databaseLock.lock(() => {
		db.verifyToken(userID, token)
			.then(function (data) {
				if (data.success === true) {
					next();
				} else {
					res.send(data);
				}
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.use("/api/resendVer", function (req, res, next) {
	const userID = req.body.userID;

	db.resendVerification(userID);
	res.send({ success: true });
});

app.use("/api/", function (req, res, next) {
	const userID = req.body.userID;

	if (userID == null) {
		res.send("Invalid inputs in body");
		return;
	}
	databaseLock.lock(() => {
		db.isUserVerified(userID)
			.then(function (data) {
				if (data.success === true) {
					next();
				} else {
					res.send(data);
				}
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.post("/api/getUserData", function (req, res, next) {
	const userID = req.body.userID;
	databaseLock.lock(() => {
		db.getUserData(userID)
			.then(function (data) {
				res.send(data);
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.post("/api/joinGroup", function (req, res, next) {
	const userID = req.body.userID;
	const groupCode = req.body.groupCode;
	if (groupCode == null) {
		res.send({ success: false, error: "parameter null" });
		return;
	}
	databaseLock.lock(() => {
		db.joinGroup(userID, groupCode)
			.then(function (data) {
				res.send(data);
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.post("/api/removeUserFromGroup", function (req, res, next) {
	const userID = req.body.userID;
	if (userID == null) {
		res.send({ success: false, error: "parameter null" });
		return;
	}
	databaseLock.lock(() => {
		db.removeUserFromGroup(userID)
			.then(function (data) {
				res.send(data);
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.post("/api/addGroup", function (req, res, next) {
	const userID = req.body.userID;
	if (userID == null) {
		res.send({ success: false, error: "parameter null" });
		return;
	}

	databaseLock.lock(() => {
		db.addGroup(userID)
			.then(function (data) {
				res.send(data);
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.post("/api/uploadFile", function (req, res, next) {
	const userID = req.body.userID;
	const fileData = req.files;

	if (!req.files) {
		res.send({
			success: false,
			error: "no file",
		});
		return;
	}

	let file = fileData.file;
	if (!file) {
		res.send({
			success: false,
			error: "no file",
		});
		return;
	}

	if (file.mimetype !== "application/pdf") {
		res.send({ success: false, error: "file not pdf" });
		return;
	}

	fs.writeFile(
		`./uploaded-files/${userID}.pdf`,
		file.data,
		"utf8",
		function (err) {
			if (err) {
				res.send({ success: false, error: err.message });
				return;
			}
			res.send({ success: true });
		}
	);
});

app.post("/api/fileUploaded", function (req, res, next) {
	const userID = req.body.userID;

	fs.access(`./uploaded-files/${userID}.pdf`, function (err) {
		if (err) {
			res.send({ success: true, data: { exists: false } });
			return;
		}

		res.send({
			success: true,
			data: { name: userID.toString() + ".pdf", exists: true },
		});
	});
});

app.post("/api/removeFile", async function (req, res, next) {
	const userID = req.body.userID;
	result = await removeUserFile(userID);
	res.send(result);
});

app.post("/api/removeUser", function (req, res, next) {
	const userID = req.body.userID;

	databaseLock.lock(() => {
		db.removeUser(userID)
			.then(function (data) {
				res.send(data);
				if (data.success) {
					removeUserFile(userID);
				}
			})
			.catch((err) => {
				res.send({ success: false, error: err });
			})
			.finally(() => {
				databaseLock.unlock();
			});
	});
});

app.post("/api/sendContactInfo", function (req, res, next) {
	const userID = req.body.userID;
	const input = req.body.val;
	let val;
	if (input === "true") {
		val = true;
	}
	else if (input === "false") {
		val = false;
	}
	else {
		res.send({success: false, error: "Invalid input."});
	}

	databaseLock.lock(() => {
		db.changeSendContact(userID, val)
			.then((data) => {
                res.send(data);
            })
			.catch((err) => {
                res.send({success: false, error: err});
            })
			.finally(() => {
                databaseLock.unlock();
            });
	});
});

//-------------------------------------------

async function removeUserFile(userID) {
	return new Promise(function (resolve, reject) {
		fs.unlink(`./uploaded-files/${userID}.pdf`, function (err) {
			if (err) {
				resolve({ success: false, error: err.message });
			}
			resolve({ success: true });
		});
	});
}

app.use(function (req, res, next) {
	res.send("Oy you're not allowed here");
});

module.exports = app;
