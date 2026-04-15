const DEFAULT_FROM_EMAIL = 'noreply@burningriverdarts.com';

let secretClient = null;
let cachedConfigPromise = null;
let cachedServicesPromise = null;

function getProjectId() {
    return process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        null;
}

function getEnvConfig() {
    return {
        twilioSid: process.env.TWILIO_ACCOUNT_SID || null,
        twilioToken: process.env.TWILIO_AUTH_TOKEN || null,
        twilioPhone: process.env.TWILIO_PHONE_NUMBER || null,
        sendgridApiKey: process.env.SENDGRID_API_KEY || null,
        fromEmail: process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL
    };
}

async function accessSecret(secretId) {
    const projectId = getProjectId();
    if (!projectId) return null;

    try {
        if (!secretClient) {
            const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
            secretClient = new SecretManagerServiceClient();
        }

        const [version] = await secretClient.accessSecretVersion({
            name: `projects/${projectId}/secrets/${secretId}/versions/latest`
        });

        const data = version.payload?.data?.toString();
        return data ? data.trim() : null;
    } catch (error) {
        console.warn(`Secret access unavailable for ${secretId}:`, error.message);
        return null;
    }
}

async function getMessagingConfig() {
    if (!cachedConfigPromise) {
        cachedConfigPromise = (async () => {
            const envConfig = getEnvConfig();

            const [twilioSid, twilioToken, twilioPhone, sendgridApiKey, fromEmail] = await Promise.all([
                accessSecret('TWILIO_ACCOUNT_SID'),
                accessSecret('TWILIO_AUTH_TOKEN'),
                accessSecret('TWILIO_PHONE_NUMBER'),
                accessSecret('SENDGRID_API_KEY'),
                accessSecret('FROM_EMAIL')
            ]);

            const hasManagedSecrets = twilioSid ||
                twilioToken ||
                twilioPhone ||
                sendgridApiKey ||
                fromEmail;

            if (hasManagedSecrets) {
                return {
                    twilioSid,
                    twilioToken,
                    twilioPhone,
                    sendgridApiKey,
                    fromEmail: fromEmail || DEFAULT_FROM_EMAIL,
                    source: 'secret-manager'
                };
            }

            return {
                ...envConfig,
                source: 'env'
            };
        })();
    }

    return cachedConfigPromise;
}

async function getMessagingServices() {
    if (!cachedServicesPromise) {
        cachedServicesPromise = (async () => {
            const config = await getMessagingConfig();

            let twilioClient = null;
            if (config.twilioSid && config.twilioToken) {
                try {
                    twilioClient = require('twilio')(config.twilioSid, config.twilioToken);
                } catch (error) {
                    console.warn('Twilio client initialization failed:', error.message);
                }
            }

            let sgMail = null;
            if (config.sendgridApiKey) {
                try {
                    sgMail = require('@sendgrid/mail');
                    sgMail.setApiKey(config.sendgridApiKey);
                } catch (error) {
                    console.warn('SendGrid client initialization failed:', error.message);
                }
            }

            return {
                config,
                twilioClient,
                sgMail
            };
        })();
    }

    return cachedServicesPromise;
}

module.exports = {
    DEFAULT_FROM_EMAIL,
    getMessagingConfig,
    getMessagingServices
};
