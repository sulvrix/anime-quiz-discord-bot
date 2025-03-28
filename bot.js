require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionsBitField,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Initialize client with enhanced options
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    ws: {
        large_threshold: 50,
        compress: true,
    },
    rest: {
        timeout: 30000,
        retries: 3,
    },
});

// Configuration
const config = {
    token: process.env.BOT_TOKEN,
    adminUsers: process.env.ADMIN_USERS?.split(",") || [],
    defaultCooldown: 30,
    questionDuration: 10,
    dataFile: path.join(__dirname, "server_data.json"),
};

// Data structure
let serverData = {};
let commandCooldowns = new Map();

// Load questions
const questions = JSON.parse(fs.readFileSync("questions.json", "utf-8"));

// Load server data from file
function loadData() {
    try {
        if (fs.existsSync(config.dataFile)) {
            const data = fs.readFileSync(config.dataFile, "utf-8");
            serverData = JSON.parse(data);

            // Reinitialize timer-related properties
            Object.keys(serverData).forEach((serverId) => {
                serverData[serverId].countdownInterval = null;
                serverData[serverId].questionTimeout = null;

                // Restart quiz if it was active
                if (serverData[serverId].quizActive) {
                    serverData[serverId].quizActive = false; // Reset state
                    console.log(
                        `Quiz was active in ${serverId}, needs manual restart`,
                    );
                }
            });
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

// Save server data to file
function saveData() {
    try {
        // Create a clean copy without circular references
        const cleanData = {};
        Object.keys(serverData).forEach((serverId) => {
            cleanData[serverId] = { ...serverData[serverId] };
            // Remove unserializable properties
            delete cleanData[serverId].countdownInterval;
            delete cleanData[serverId].questionTimeout;
        });

        fs.writeFileSync(config.dataFile, JSON.stringify(cleanData, null, 2));
    } catch (err) {
        console.error("Error saving data:", err);
    }
}

// Initialize server data
function initServer(serverId) {
    if (!serverData[serverId]) {
        serverData[serverId] = {
            quizActive: false,
            currentQuestion: null,
            lastQuestion: null,
            scores: {},
            answeredUsers: [],
            quizChannel: null,
            countdownInterval: null, // Will not be saved
            questionTimeout: null, // Will not be saved
        };
    }
    return serverData[serverId];
}

// Get a random question
function getRandomQuestion(serverId) {
    const server = serverData[serverId];
    let randomQuestion;
    let attempts = 0;
    const maxAttempts = questions.length * 2;

    do {
        randomQuestion =
            questions[Math.floor(Math.random() * questions.length)];
        attempts++;
        if (attempts >= maxAttempts) break; // Prevent infinite loops
    } while (
        server.lastQuestion &&
        randomQuestion.question === server.lastQuestion.question
    );

    server.lastQuestion = randomQuestion;
    return randomQuestion;
}

// Post question to a specific server
async function postDailyQuestion(serverId) {
    try {
        const server = serverData[serverId];
        if (!server || !server.quizActive || !server.quizChannel) return;

        const channel = client.channels.cache.get(server.quizChannel);
        if (!channel) {
            console.error(`Channel ${server.quizChannel} not found`);
            server.quizActive = false;
            saveData();
            return;
        }

        const randomQuestion = getRandomQuestion(serverId);
        server.currentQuestion = randomQuestion;
        server.answeredUsers = [];
        saveData();

        let answerTime = config.questionDuration;

        const embed = new EmbedBuilder()
            .setTitle("\u200F🎌 سؤال الأنمي اليومي 🎌")
            .setDescription("\u200F" + randomQuestion.question)
            .setColor("#FFD700")
            .setThumbnail(
                "https://static.wikia.nocookie.net/frieren/images/9/96/Himmel_anime_portrait.png/revision/latest?cb=20231017083515",
            )
            .setImage(randomQuestion.image)
            .addFields({ name: "\u200B", value: "\u200B" })
            .addFields({
                name: "\u200Fالوقت المتبقي",
                value: `\u200F⏳ ${answerTime} ثانية`,
            })
            .setFooter({ text: "\u200Fأنمي كويز بوت" })
            .setTimestamp();

        const questionMessage = await channel.send({ embeds: [embed] });

        // Countdown timer
        server.countdownInterval = setInterval(async () => {
            try {
                answerTime--;

                const updatedEmbed = new EmbedBuilder()
                    .setTitle("\u200F🎌 سؤال الأنمي اليومي 🎌")
                    .setDescription("\u200F" + randomQuestion.question)
                    .setColor("#FFD700")
                    .setThumbnail(
                        "https://static.wikia.nocookie.net/frieren/images/9/96/Himmel_anime_portrait.png/revision/latest?cb=20231017083515",
                    )
                    .setImage(randomQuestion.image)
                    .addFields({ name: "\u200B", value: "\u200B" })
                    .addFields({
                        name: "\u200Fالوقت المتبقي",
                        value: `\u200F⏳ ${answerTime} ثانية`,
                    })
                    .setFooter({ text: "\u200Fأنمي كويز بوت" })
                    .setTimestamp();

                await questionMessage.edit({ embeds: [updatedEmbed] });

                if (
                    answerTime <= 0 ||
                    !server.quizActive ||
                    !server.currentQuestion
                ) {
                    clearInterval(server.countdownInterval);
                    server.countdownInterval = null;

                    if (server.currentQuestion) {
                        const answerEmbed = new EmbedBuilder()
                            .setTitle("\u200F⏰ انتهى الوقت ⏰")
                            .setDescription(
                                `\u200Fالإجابة الصحيحة هي: **${server.currentQuestion.correctAnswer}**`,
                            )
                            .setColor("#FF0000")
                            .setFooter({ text: "\u200Fأنمي كويز بوت" })
                            .setTimestamp();

                        await channel.send({ embeds: [answerEmbed] });
                        server.currentQuestion = null;
                        saveData();
                    }

                    if (server.quizActive) {
                        server.questionTimeout = setTimeout(
                            () => postDailyQuestion(serverId),
                            config.defaultCooldown * 1000,
                        );
                        saveData();
                    }
                }
            } catch (error) {
                console.error("Countdown error:", error);
                clearInterval(server.countdownInterval);
                server.countdownInterval = null;
            }
        }, 1000);
        saveData();
    } catch (error) {
        console.error("Error posting question:", error);
        serverData[serverId].quizActive = false;
        saveData();
    }
}

// Check if user has admin permissions
function isAdmin(member) {
    if (!member) return false;
    return (
        member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        config.adminUsers.includes(member.id)
    );
}

// Bot events
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    loadData();

    // Initialize all servers
    client.guilds.cache.forEach((guild) => {
        initServer(guild.id);
    });

    // Periodic cleanup
    setInterval(() => {
        Object.keys(serverData).forEach((serverId) => {
            if (!client.guilds.cache.has(serverId)) {
                delete serverData[serverId];
            }
        });
        saveData();
    }, 3600000); // Every hour
});

client.on("shardDisconnect", (event, shardId) => {
    console.error(`Shard ${shardId} disconnected!`, event);
});

client.on("shardReconnecting", (shardId) => {
    console.log(`Shard ${shardId} reconnecting...`);
});

// Message handling
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.guild) return;
        if (!message.channel) return;

        // Cooldown check
        if (commandCooldowns.has(message.author.id)) return;
        commandCooldowns.set(message.author.id, true);
        setTimeout(() => commandCooldowns.delete(message.author.id), 1000);

        const serverId = message.guild.id;
        const server = initServer(serverId);
        const prefix = "!";

        if (message.content.startsWith("!")) {
            // Block non-setup commands if no channel set
            if (!server.quizChannel && !message.content.startsWith("!setup"))
                return;

            // Block all commands not in quiz channel (except setup)
            if (
                server.quizChannel &&
                message.channel.id !== server.quizChannel &&
                !message.content.startsWith("!setup")
            ) {
                return;
            }

            const args = message.content
                .slice(prefix.length)
                .trim()
                .split(/ +/);
            const command = args.shift().toLowerCase();

            switch (command) {
                case "setup":
                    if (!isAdmin(message.member)) {
                        return;
                    }

                    const me = message.guild.members.me;
                    if (!me) return;

                    const requiredPerms = [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.EmbedLinks,
                    ];

                    const missingPerms = message.channel
                        .permissionsFor(me)
                        .missing(requiredPerms);
                    if (missingPerms.length > 0) {
                        return message
                            .reply({
                                content: `❌ البوت يحتاج إلى هذه الصلاحيات:\n${missingPerms.join("\n")}`,
                                ephemeral: true,
                            })
                            .catch(console.error);
                    }

                    server.quizChannel = message.channel.id;
                    saveData();
                    message
                        .reply(`✅ تم تعيين ${message.channel} كقناة المسابقة!`)
                        .catch(console.error);
                    break;

                case "test":
                    if (!isAdmin(message.member)) return;

                    const testEmbed = new EmbedBuilder()
                        .setTitle("🧪 اختبار حالة البوت")
                        .addFields(
                            {
                                name: "السؤال الحالي",
                                value: server.currentQuestion
                                    ? server.currentQuestion.question
                                    : "لا يوجد",
                            },
                            {
                                name: "الإجابة الصحيحة",
                                value: server.currentQuestion
                                    ? server.currentQuestion.correctAnswer
                                    : "لا يوجد",
                            },
                            {
                                name: "القناة المحددة",
                                value: server.quizChannel
                                    ? `<#${server.quizChannel}>`
                                    : "غير محددة",
                            },
                            {
                                name: "حالة المسابقة",
                                value: server.quizActive ? "نشطة" : "غير نشطة",
                            },
                        )
                        .setColor("#FFA500");

                    await message.channel.send({ embeds: [testEmbed] });
                    break;

                case "start":
                    if (message.channel.id !== server.quizChannel) return;
                    if (!isAdmin(message.member)) {
                        return;
                    }

                    if (server.quizActive) {
                        return message
                            .reply("ℹ️ المسابقة تعمل بالفعل!")
                            .catch(console.error);
                    }

                    server.quizActive = true;
                    saveData();
                    message
                        .reply("🎉 تم بدء المسابقة! سيتم نشر الأسئلة تلقائياً.")
                        .catch(console.error);
                    postDailyQuestion(serverId);
                    break;

                case "stop":
                    if (message.channel.id !== server.quizChannel) return;
                    if (!isAdmin(message.member)) {
                        return;
                    }

                    if (!server.quizActive) {
                        return message
                            .reply("ℹ️ المسابقة متوقفة بالفعل!")
                            .catch(console.error);
                    }

                    server.quizActive = false;
                    if (server.countdownInterval)
                        clearInterval(server.countdownInterval);
                    if (server.questionTimeout)
                        clearTimeout(server.questionTimeout);
                    server.currentQuestion = null;
                    saveData();
                    message.reply("⏸️ تم إيقاف المسابقة.").catch(console.error);
                    break;

                case "score":
                    try {
                        const sortedScores = Object.entries(server.scores || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10);

                        const leaderboard =
                            sortedScores.length > 0
                                ? sortedScores
                                      .map(
                                          ([userId, score], index) =>
                                              `**${index + 1}.** <@${userId}>: ${score} نقاط`,
                                      )
                                      .join("\n")
                                : "لا توجد نقاط حتى الآن!";

                        const embed = new EmbedBuilder()
                            .setTitle("🏆 لوحة المتصدرين 🏆")
                            .setDescription(leaderboard)
                            .setColor("#00FF00")
                            .setFooter({
                                text: `أنمي كويز بوت | ${message.guild.name}`,
                            })
                            .setTimestamp();

                        await message.channel.send({ embeds: [embed] });
                    } catch (err) {
                        console.error("Score command failed:", err);
                    }
                    break;

                case "help":
                    try {
                        const helpEmbed = new EmbedBuilder()
                            .setTitle("🛠️ مساعدة أنمي كويز بوت 🛠️")
                            .setDescription(
                                "**مرحباً! إليك كيفية استخدام البوت:**",
                            )
                            .setColor("#00BFFF")
                            .addFields(
                                {
                                    name: "⚙️ **أوامر الإعداد**",
                                    value: `
                                        - \`!setup\`: تعيين القناة الحالية لقناة المسابقة (للمشرفين)
                                        - \`!start\`: بدء المسابقة (للمشرفين)
                                        - \`!stop\`: إيقاف المسابقة (للمشرفين)
                                    `,
                                },
                                {
                                    name: "🏆 **أوامر المسابقة**",
                                    value: `
                                        - \`!score\`: عرض أفضل 10 لاعبين
                                        - \`!help\`: عرض هذه الرسالة
                                    `,
                                },
                                {
                                    name: "⏱️ **قواعد المسابقة**",
                                    value: `
                                        - اكتب الإجابة الصحيحة في الشات
                                        - لديك ${config.questionDuration} ثانية للإجابة
                                        - جائزة لكل إجابة صحيحة: 1 نقطة
                                    `,
                                },
                            )
                            .setFooter({ text: "تمتع بوقتك مع الأنمي!" });

                        await message.channel.send({ embeds: [helpEmbed] });
                    } catch (err) {
                        console.error("Help command failed:", err);
                    }
                    break;

                case "reset":
                    if (message.channel.id !== server.quizChannel) return;
                    if (!isAdmin(message.member)) {
                        return;
                    }

                    server.scores = {};
                    saveData();
                    message
                        .reply("🔄 تم إعادة تعيين النقاط للجميع!")
                        .catch(console.error);
                    break;

                case "invite":
                    try {
                        const inviteEmbed = new EmbedBuilder()
                            .setTitle("🔗 دعوة البوت إلى سيرفرك!")
                            .setDescription(
                                `[انقر هنا لإضافة البوت إلى سيرفرك](${generateInviteLink()})`,
                            )
                            .setColor("#7289DA")
                            .setFooter({ text: "شكراً لدعمك!" });

                        await message.channel.send({ embeds: [inviteEmbed] });
                    } catch (err) {
                        console.error("Invite command failed:", err);
                    }
                    break;

                default:
                    // Unknown command - silently ignore
                    break;
            }
            return;
        }

        // Handle answers to questions
        if (
            server.currentQuestion &&
            message.channel.id === server.quizChannel
        ) {
            console.log(
                "Answer detection started for message:",
                message.content,
            );

            // Enhanced normalization function
            const normalizeText = (text) => {
                const normalized = text
                    .trim()
                    .normalize("NFC") // Unicode normalization
                    .replace(/[إأآ]/g, "ا") // Normalize Alef variants
                    .replace(/ة/g, "ه"); // Normalize Ta Marbuta

                return normalized;
            };

            const userAnswer = normalizeText(message.content);
            const correctAnswer = normalizeText(
                server.currentQuestion.correctAnswer,
            );

            // Add this right before the answer comparison
            console.log("User answer:", userAnswer);
            console.log("Correct answer:", correctAnswer);
            console.log("Comparison:", userAnswer === correctAnswer);

            if (server.answeredUsers.includes(message.author.id)) {
                return message
                    .reply("⏳ لقد أجبت بالفعل على هذا السؤال!")
                    .catch(console.error);
            }

            if (userAnswer === correctAnswer) {
                server.answeredUsers.push(message.author.id);
                server.scores[message.author.id] =
                    (server.scores[message.author.id] || 0) + 1;
                saveData();

                try {
                    await message
                        .react("✅")
                        .catch((e) =>
                            console.log("Couldn't react, but continuing:", e),
                        );

                    await message.channel.send(
                        `🎉 <@${message.author.id}> أجاب بشكل صحيح!`,
                    );
                } catch (err) {
                    console.error("Error handling correct answer:", err);
                }

                // Clean up current question
                if (server.countdownInterval) {
                    clearInterval(server.countdownInterval);
                }
                if (server.questionTimeout) {
                    clearTimeout(server.questionTimeout);
                }
                server.currentQuestion = null;
                saveData();

                if (server.quizActive) {
                    server.questionTimeout = setTimeout(
                        () => postDailyQuestion(serverId),
                        config.defaultCooldown * 1000,
                    );
                    console.log("Set new question timeout");
                    saveData();
                }
            } else {
                console.log("Answer did not match");
            }
        }
    } catch (error) {
        console.error("Message handler error:", error);
    }
});

// Error handling
process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

// =====================
// Process Cleanup Handler
// =====================
process.on("SIGINT", async () => {
    console.log(
        "\n[SHUTDOWN] Received SIGINT - Saving data and cleaning up...",
    );

    // 1. Clear all active timers
    Object.keys(serverData).forEach((serverId) => {
        const server = serverData[serverId];
        server.quizActive = false;

        if (server.countdownInterval) {
            clearInterval(server.countdownInterval);
            console.log(`[SHUTDOWN] Cleared interval for server ${serverId}`);
        }
        if (server.questionTimeout) {
            clearTimeout(server.questionTimeout);
            console.log(`[SHUTDOWN] Cleared timeout for server ${serverId}`);
        }
    });

    // 2. Force save data
    try {
        await saveData();
        console.log("[SHUTDOWN] Data saved successfully");
    } catch (err) {
        console.error("[SHUTDOWN] Error saving data:", err);
    }

    // 3. Disconnect client
    client.destroy();
    console.log("[SHUTDOWN] Discord client destroyed");

    // 4. Exit process
    process.exit(0);
});

// Start the bot (this is your existing line)
client.login(config.token).catch((err) => {
    console.error("Failed to login:", err);
    process.exit(1);
});
