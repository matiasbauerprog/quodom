const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

module.exports = {
    sendEmail
};

async function sendEmail(user, link, subject, template) {
    if (process.env.EMAIL_ENABLED !== 'true') {
        console.log(`[email disabled] ${subject} -> ${user.email}: ${link}`);
        return true;
    }

    const templatePath = path.join(__dirname, '../lib/email/templates/', template + '.ejs');

    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: { rejectUnauthorized: false }
    });

    const html = await ejs.renderFile(templatePath, {
        nombre: user.nombre,
        emailAddress: user.email,
        resetLink: link
    });

    try {
        const info = await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: subject,
            html: html
        });
        console.log('Message sent: ' + info.response);
        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
}
