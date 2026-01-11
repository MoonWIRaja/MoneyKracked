import {
	SMTP_HOST,
	SMTP_PORT,
	SMTP_SECURE,
	SMTP_USER,
	SMTP_PASS,
	SMTP_FROM,
	SMTP_FROM_NAME,
	BETTER_AUTH_URL
} from '$env/static/private';

// Dynamic import for nodemailer (server-only)
async function getNodemailer() {
	if (typeof window !== 'undefined') {
		return null;
	}
	try {
		const nodemailer = await import('nodemailer');
		return nodemailer;
	} catch {
		return null;
	}
}

// Create transporter
const createTransporter = async () => {
	if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
		console.warn('[Email] SMTP not configured. Email sending will be disabled.');
		return null;
	}

	const nodemailer = await getNodemailer();
	if (!nodemailer) {
		return null;
	}

	return nodemailer.createTransport({
		host: SMTP_HOST,
		port: parseInt(SMTP_PORT || '587'),
		secure: SMTP_SECURE === 'true', // true for 465, false for other ports
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASS
		}
	});
};

// Email verification template
export const verificationEmailTemplate = (name: string, verificationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Verify Your Email</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
		.logo { font-size: 24px; font-weight: bold; color: #21c462; }
		.content { padding: 30px 0; }
		.button { display: inline-block; padding: 12px 30px; background: #21c462; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
		.button:hover { background: #1a9f4f; }
		.code { background: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 3px; border-radius: 6px; margin: 20px 0; font-family: monospace; }
		.footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #888; }
		.warning { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">MoneyKracked</div>
		</div>
		<div class="content">
			<h2>Verify Your Email Address</h2>
			<p>Hi ${name},</p>
			<p>Thank you for registering with MoneyKracked! To complete your registration, please verify your email address by clicking the button below:</p>
			<div style="text-align: center; margin: 30px 0;">
				<a href="${verificationUrl}" class="button">Verify Email Address</a>
			</div>
			<p>Or copy and paste this link into your browser:</p>
			<p style="word-break: break-all; color: #21c462; font-size: 12px;">${verificationUrl}</p>
			<div class="warning">
				<strong>This link will expire in 24 hours.</strong><br>
				If you didn't create an account with MoneyKracked, you can safely ignore this email.
			</div>
		</div>
		<div class="footer">
			<p>MoneyKracked - Smart Finance Dashboard</p>
			<p>If you're having trouble clicking the button, copy and paste the URL into your web browser.</p>
		</div>
	</div>
</body>
</html>
`;

// Send verification email
export async function sendVerificationEmail(email: string, name: string, tokenOrUrl: string) {
	const transporter = await createTransporter();

	if (!transporter) {
		console.error('[Email] Cannot send email - SMTP not configured');
		return false;
	}

	// Check if it's a full URL or just a token
	const baseUrl = BETTER_AUTH_URL || 'http://localhost:5173';
	const verificationUrl = tokenOrUrl.startsWith('http')
		? tokenOrUrl
		: `${baseUrl}/verify-email?token=${tokenOrUrl}`;

	try {
		const info = await transporter.sendMail({
			from: `"${SMTP_FROM_NAME || 'MoneyKracked'}" <${SMTP_FROM}>`,
			to: email,
			subject: 'Verify Your Email Address - MoneyKracked',
			html: verificationEmailTemplate(name, verificationUrl)
		});

		console.log('[Email] Verification email sent:', info.messageId);
		return true;
	} catch (error) {
		console.error('[Email] Failed to send verification email:', error);
		return false;
	}
}

// Send password reset email
export const resetEmailTemplate = (name: string, resetUrl: string) => `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Reset Your Password</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
		.logo { font-size: 24px; font-weight: bold; color: #21c462; }
		.content { padding: 30px 0; }
		.button { display: inline-block; padding: 12px 30px; background: #21c462; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
		.button:hover { background: #1a9f4f; }
		.footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #888; }
		.warning { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">MoneyKracked</div>
		</div>
		<div class="content">
			<h2>Reset Your Password</h2>
			<p>Hi ${name},</p>
			<p>We received a request to reset your password. Click the button below to create a new password:</p>
			<div style="text-align: center; margin: 30px 0;">
				<a href="${resetUrl}" class="button">Reset Password</a>
			</div>
			<p>Or copy and paste this link into your browser:</p>
			<p style="word-break: break-all; color: #21c462; font-size: 12px;">${resetUrl}</p>
			<div class="warning">
				<strong>This link will expire in 1 hour.</strong><br>
				If you didn't request a password reset, you can safely ignore this email.
			</div>
		</div>
		<div class="footer">
			<p>MoneyKracked - Smart Finance Dashboard</p>
		</div>
	</div>
</body>
</html>
`;

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
	const transporter = await createTransporter();

	if (!transporter) {
		console.error('[Email] Cannot send email - SMTP not configured');
		return false;
	}

	const baseUrl = BETTER_AUTH_URL || 'http://localhost:5173';
	const resetUrl = `${baseUrl}/reset-password?token=${token}`;

	try {
		const info = await transporter.sendMail({
			from: `"${SMTP_FROM_NAME || 'MoneyKracked'}" <${SMTP_FROM}>`,
			to: email,
			subject: 'Reset Your Password - MoneyKracked',
			html: resetEmailTemplate(name, resetUrl)
		});

		console.log('[Email] Password reset email sent:', info.messageId);
		return true;
	} catch (error) {
		console.error('[Email] Failed to send password reset email:', error);
		return false;
	}
}
