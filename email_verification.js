const nodemailer = require("nodemailer")
const smtpTransport = require('nodemailer-smtp-transport')

require('custom-env').env('mailver')

const transport = {
    host: 'smtp.google.com',
    port: 465,
    secure: true,
}

const options = {
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
        user: process.env.USER_NAME,
        pass: process.env.APP_PASSWORD
    }
}
const transporter = nodemailer.createTransport(smtpTransport(options))
transporter.verify((error, success) => {
    if(error) {
        console.log(error)
    } else {
        console.log("mail setup")
    }
})


function sendCode(email, code) {
    const mail = {
        from: process.env.USER_NAME,
        to: email,
        subject: "Bath Wackathon Email Verification",
        text: `Thank you for signing up to the Bath Wackathon 2022.\nClick this link to verify your email: ${process.env.URL}verify?code=${code}\nThe link may be unusually long due to university security protocol.`
    }

    transporter.sendMail(mail, (err, data) => {
        if (err) {
            console.log("MAIL SEND ERROR")
            console.log(err)
        } else {
            console.log("sent email successfully")
        }
    })
}

module.exports.sendMail = sendCode;