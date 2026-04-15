function createAuthHandlers({ admin, db, getMessagingServices }) {
    async function sendWelcomeSMS(phone, name, pin) {
        const { twilioClient, config } = await getMessagingServices();

        if (!twilioClient) {
            console.log('Welcome SMS (simulated):', { phone, name, pin, source: config.source });
            return { success: true, simulated: true };
        }

        try {
            const message = `BRDC: Welcome ${name}! Your player PIN is ${pin}. Use this to log in and track your stats. Save this number!`;
            const result = await twilioClient.messages.create({
                body: message,
                to: phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, ''),
                from: config.twilioPhone
            });
            return { success: true, sid: result.sid };
        } catch (err) {
            console.error('Welcome SMS error:', err);
            return { success: false, error: err.message };
        }
    }

    async function sendWelcomeEmail(email, name, pin) {
        const { sgMail, config } = await getMessagingServices();

        if (!sgMail) {
            console.log('Welcome email (simulated):', { email, name, pin, source: config.source });
            return { success: true, simulated: true };
        }

        const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#fff;padding:30px;border-radius:12px;">
            <div style="text-align:center;margin-bottom:30px;">
                <h1 style="color:#FF469A;margin:0;">BRDC</h1>
                <p style="color:#91D7EB;margin:5px 0;">Burning River Dart Club</p>
            </div>
            <h2 style="color:#10b981;text-align:center;">Welcome to BRDC!</h2>
            <p>Hi ${name},</p>
            <p>Your player account has been created successfully. You can now play games and track your stats!</p>
            <div style="background:linear-gradient(135deg,#FF469A22,#91D7EB22);padding:20px;border-radius:8px;border-left:4px solid #FF469A;margin:20px 0;">
                <h3 style="color:#FDD835;margin-top:0;">Your Player PIN</h3>
                <p style="font-size:32px;font-weight:bold;text-align:center;color:#91D7EB;letter-spacing:8px;margin:10px 0;">${pin}</p>
                <p style="font-size:12px;text-align:center;color:#a0a0b0;">Use this PIN to log in at the game setup page</p>
            </div>
            <p>Keep this PIN safe - you'll need it to access your player profile and track your stats.</p>
            <hr style="border:1px solid rgba(255,255,255,0.1);margin:30px 0;">
            <p style="color:#a0a0b0;font-size:12px;text-align:center;">Burning River Dart Club | Cleveland, OH</p>
        </div>
    `;

        const textVersion = `Welcome to BRDC!\n\nHi ${name},\n\nYour player account has been created.\n\nYour Player PIN: ${pin}\n\nUse this PIN to log in and track your stats.\n\nBurning River Dart Club`;

        try {
            await sgMail.send({
                to: email,
                from: config.fromEmail,
                subject: 'Welcome to BRDC - Your Player PIN',
                html: emailHtml,
                text: textVersion
            });
            return { success: true };
        } catch (err) {
            console.error('Welcome email error:', err);
            return { success: false, error: err.message };
        }
    }

    function setCorsHeaders(res) {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    async function generateUniquePinWithPhone(phoneLast4) {
        let attempts = 0;
        while (attempts < 100) {
            const randomPart = String(Math.floor(1000 + Math.random() * 9000));
            const pin = phoneLast4 + randomPart;

            const existingPlayer = await db.collection('players')
                .where('pin', '==', pin)
                .limit(1)
                .get();

            const existingBot = await db.collection('bots')
                .where('pin', '==', pin)
                .limit(1)
                .get();

            if (existingPlayer.empty && existingBot.empty) {
                return pin;
            }
            attempts++;
        }
        throw new Error('Could not generate unique PIN');
    }

    async function generateUniqueFullPin() {
        let attempts = 0;
        while (attempts < 100) {
            const pin = String(Math.floor(10000000 + Math.random() * 90000000));

            const existingPlayer = await db.collection('players')
                .where('pin', '==', pin)
                .limit(1)
                .get();

            if (existingPlayer.empty) {
                return pin;
            }
            attempts++;
        }
        throw new Error('Could not generate unique PIN');
    }

    async function recoverPin(req, res) {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') return res.status(204).send('');

        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ success: false, error: 'Email is required' });
            }

            const emailLower = email.toLowerCase().trim();
            const playerSnapshot = await db.collection('players')
                .where('email', '==', emailLower)
                .limit(1)
                .get();

            if (playerSnapshot.empty) {
                return res.json({
                    success: true,
                    message: 'If an account exists with this email, your PIN has been sent.'
                });
            }

            const player = playerSnapshot.docs[0].data();

            await db.collection('notifications_queue').add({
                type: 'pin_recovery',
                to_email: emailLower,
                to_name: player.name,
                pin: player.pin,
                chosen_pin: player.chosen_pin,
                phone_last4: player.phone_last4,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`PIN recovery requested for ${emailLower}`);

            return res.json({
                success: true,
                message: 'If an account exists with this email, your 8-digit PIN has been sent.'
            });
        } catch (error) {
            console.error('PIN recovery error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async function registerNewPlayer(req, res) {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') return res.status(204).send('');

        try {
            const { first_name, last_name, email, phone, preferred_level } = req.body;

            if (!first_name || !last_name) {
                return res.status(400).json({ success: false, error: 'First name and last name are required' });
            }

            if (!email) {
                return res.status(400).json({ success: false, error: 'Email is required' });
            }

            const emailLower = email.toLowerCase().trim();
            const fullName = `${first_name.trim()} ${last_name.trim()}`;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(emailLower)) {
                return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
            }

            const existingByEmail = await db.collection('players')
                .where('email', '==', emailLower)
                .limit(1)
                .get();

            if (!existingByEmail.empty) {
                return res.status(400).json({
                    success: false,
                    error: 'An account with this email already exists. Use your PIN to login.'
                });
            }

            let phoneClean = null;
            let phoneLast4 = null;
            if (phone) {
                phoneClean = phone.replace(/\D/g, '');
                if (phoneClean.length >= 4) {
                    phoneLast4 = phoneClean.slice(-4);
                }

                if (phoneClean.length >= 10) {
                    const existingByPhone = await db.collection('players')
                        .where('phone', '==', phoneClean)
                        .limit(1)
                        .get();

                    if (!existingByPhone.empty) {
                        return res.status(400).json({
                            success: false,
                            error: 'An account with this phone number already exists. Use your PIN to login.'
                        });
                    }
                }
            }

            const pin = phoneLast4
                ? await generateUniquePinWithPhone(phoneLast4)
                : await generateUniqueFullPin();

            const playerData = {
                name: fullName,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                email: emailLower,
                phone: phoneClean,
                phone_last4: phoneLast4,
                pin,
                preferred_level: preferred_level || null,
                photo_url: null,
                isBot: false,
                notification_preference: phoneClean ? 'sms' : 'email',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                stats: {
                    matches_played: 0,
                    matches_won: 0,
                    x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                    cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 }
                },
                involvements: { leagues: [], tournaments: [], directing: [], captaining: [] }
            };

            const playerRef = await db.collection('players').add(playerData);
            const emailResult = await sendWelcomeEmail(emailLower, fullName, pin);
            const emailSent = emailResult.success || emailResult.simulated || false;

            let smsSent = false;
            if (phoneClean && phoneClean.length >= 10) {
                const smsResult = await sendWelcomeSMS(phoneClean, fullName, pin);
                smsSent = smsResult.success || smsResult.simulated || false;
            }

            await db.collection('notifications').add({
                type: 'player_signup',
                to_phone: phoneClean || null,
                to_email: emailLower,
                player_id: playerRef.id,
                player_name: fullName,
                sms_sent: smsSent,
                email_sent: emailSent,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`New player signed up: ${fullName} (${playerRef.id})`);

            return res.json({
                success: true,
                player_id: playerRef.id,
                message: `Welcome ${fullName}! Your PIN is ${pin}. Save this - you'll use it to login.`
            });
        } catch (error) {
            console.error('Register new player error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async function registerPlayerSimple(req, res) {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') return res.status(204).send('');

        try {
            const { first_name, last_name, phone, email } = req.body;

            if (!first_name || !last_name) {
                return res.status(400).json({ success: false, error: 'First name and last name are required' });
            }

            if (!phone) {
                return res.status(400).json({ success: false, error: 'Phone number is required' });
            }

            const phoneClean = phone.replace(/\D/g, '');
            if (phoneClean.length < 10) {
                return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit phone number' });
            }

            const fullName = `${first_name.trim()} ${last_name.trim()}`;
            const emailLower = email ? email.toLowerCase().trim() : null;

            const existingPlayer = await db.collection('players')
                .where('phone', '==', phoneClean)
                .limit(1)
                .get();

            if (!existingPlayer.empty) {
                return res.status(400).json({
                    success: false,
                    error: 'An account with this phone number already exists. Use your PIN to login.'
                });
            }

            const phoneLast4 = phoneClean.slice(-4);
            const pin = await generateUniquePinWithPhone(phoneLast4);

            const playerData = {
                name: fullName,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                email: emailLower,
                phone: phoneClean,
                phone_last4: phoneLast4,
                pin,
                photo_url: null,
                isBot: false,
                notification_preference: 'sms',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                stats: {
                    matches_played: 0,
                    matches_won: 0,
                    x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                    cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 }
                },
                involvements: { leagues: [], tournaments: [], directing: [], captaining: [] }
            };

            const playerRef = await db.collection('players').add(playerData);
            const smsResult = await sendWelcomeSMS(phoneClean, fullName, pin);
            if (!smsResult.success && !smsResult.simulated) {
                console.warn(`Welcome SMS failed for ${phoneClean}:`, smsResult.error);
            }

            let emailSent = false;
            if (emailLower) {
                const emailResult = await sendWelcomeEmail(emailLower, fullName, pin);
                emailSent = emailResult.success || emailResult.simulated || false;
            }

            await db.collection('notifications').add({
                type: 'player_welcome',
                to_phone: phoneClean,
                to_email: emailLower || null,
                player_id: playerRef.id,
                player_name: fullName,
                sms_sent: smsResult.success || smsResult.simulated || false,
                email_sent: emailSent,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`New player registered: ${fullName} (${playerRef.id})`);

            return res.json({
                success: true,
                player: {
                    id: playerRef.id,
                    name: fullName
                },
                message: `Welcome ${fullName}! Your PIN has been sent via text.`
            });
        } catch (error) {
            console.error('Simple register player error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return {
        recoverPin,
        registerNewPlayer,
        registerPlayerSimple
    };
}

module.exports = {
    createAuthHandlers
};
