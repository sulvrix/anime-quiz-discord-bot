require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionsBitField,
    Collection,
    REST,
    Routes,
    MessageFlags,
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
    clientId: process.env.CLIENT_ID,
};

// Command handling
client.commands = new Collection();

// Define slash commands
const commands = [
    {
        name: "setup",
        description: "تعيين القناة الحالية لقناة المسابقة (للمشرفين)",
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: "start",
        description: "بدء المسابقة (للمشرفين)",
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: "stop",
        description: "إيقاف المسابقة (للمشرفين)",
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    {
        name: "score",
        description: "عرض أفضل 10 لاعبين",
    },
    {
        name: "help",
        description: "عرض رسالة المساعدة",
    },
    {
        name: "reset",
        description: "إعادة تعيين النقاط للجميع (للمشرفين)",
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
    // {
    //     name: "invite",
    //     description: "الحصول على رابط دعوة البوت",
    // },
    {
        name: "test",
        description: "اختبار حالة البوت (للمشرفين)",
        default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    },
];

// Register slash commands
async function registerCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);

        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

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
client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    loadData();

    // Initialize all servers
    client.guilds.cache.forEach((guild) => {
        initServer(guild.id);
    });

    // Register slash commands
    await registerCommands();

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

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    // const publicCommands = ["start", "help", "score", "invite"];
    const publicCommands = ["start", "help", "score"];

    try {
        // Conditionally defer based on command type
        if (publicCommands.includes(interaction.commandName)) {
            await interaction.deferReply(); // Public defer
        } else {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // Private defer
        }


        const { commandName, guild, channel, member } = interaction;
        const serverId = guild.id;
        const server = initServer(serverId);

        // Block non-setup commands if no channel set
        if (!server.quizChannel && commandName !== "setup") {
            return interaction.editReply({
                content: "❌ لم يتم تعيين قناة المسابقة بعد! استخدم `/setup` أولاً."
            });
        }

        // Block all commands not in quiz channel (except setup)
        if (
            server.quizChannel &&
            channel.id !== server.quizChannel &&
            commandName !== "setup"
        ) {
            return interaction.editReply({
                content: `❌ يجب استخدام الأوامر في قناة المسابقة المخصصة: <#${server.quizChannel}>`,
            });
        }

        try {
            switch (commandName) {
                case "setup":
                    if (!isAdmin(member)) {
                        return interaction.editReply({
                            content: "❌ ليس لديك صلاحية استخدام هذا الأمر!",
                        });
                    }

                    const me = guild.members.me;
                    if (!me) return;

                    const requiredPerms = [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.EmbedLinks,
                    ];

                    const missingPerms = channel
                        .permissionsFor(me)
                        .missing(requiredPerms);
                    if (missingPerms.length > 0) {
                        return interaction.editReply({
                            content: `❌ البوت يحتاج إلى هذه الصلاحيات:\n${missingPerms.join("\n")}`,
                        });
                    }

                    server.quizChannel = channel.id;
                    saveData();
                    interaction.editReply(`✅ تم تعيين ${channel} كقناة المسابقة!`);
                    break;

                case "test":
                    if (!isAdmin(member)) {
                        return interaction.editReply({
                            content: "❌ ليس لديك صلاحية استخدام هذا الأمر!",
                        });
                    }

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

                    await interaction.editReply({
                        embeds: [testEmbed],
                    });
                    break;

                case "start":
                    if (!isAdmin(member)) {
                        return interaction.editReply({
                            content: "❌ ليس لديك صلاحية استخدام هذا الأمر!",
                        });
                    }

                    if (server.quizActive) {
                        return interaction.editReply("ℹ️ المسابقة تعمل بالفعل!");
                    }

                    server.quizActive = true;
                    saveData();
                    await interaction.editReply("🎉 تم بدء المسابقة! سيتم نشر الأسئلة تلقائياً.");
                    postDailyQuestion(serverId);
                    break;

                case "stop":
                    if (!isAdmin(member)) {
                        return interaction.editReply({
                            content: "❌ ليس لديك صلاحية استخدام هذا الأمر!",
                        });
                    }

                    if (!server.quizActive) {
                        return interaction.editReply("ℹ️ المسابقة متوقفة بالفعل!");
                    }

                    server.quizActive = false;
                    if (server.countdownInterval)
                        clearInterval(server.countdownInterval);
                    if (server.questionTimeout)
                        clearTimeout(server.questionTimeout);
                    server.currentQuestion = null;
                    saveData();
                    interaction.editReply("⏸️ تم إيقاف المسابقة.");
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

                        const scoreEmbed = new EmbedBuilder()
                            .setTitle("🏆 لوحة المتصدرين 🏆")
                            .setDescription(leaderboard)
                            .setColor("#00FF00")
                            .setFooter({
                                text: `أنمي كويز بوت | ${guild.name}`,
                            })
                            .setTimestamp();

                        await interaction.editReply({
                            embeds: [scoreEmbed]
                        });
                        break;

                    } catch (err) {
                        console.error("Score command failed:", err);
                        interaction.editReply({
                            content: "❌ حدث خطأ أثناء عرض النتائج!",
                        });
                    }
                    break;

                case "help":
                    try {
                        const helpEmbed = new EmbedBuilder()
                            .setTitle("🛠️ مساعدة أنمي كويز بوت 🛠️")
                            .setDescription("**مرحباً! إليك كيفية استخدام البوت:**")
                            .setColor("#00BFFF")
                            .addFields(
                                {
                                    name: "⚙️ **أوامر الإعداد**",
                                    value: `
                                    - \`/setup\`: تعيين القناة الحالية لقناة المسابقة (للمشرفين)
                                    - \`/start\`: بدء المسابقة (للمشرفين)
                                    - \`/stop\`: إيقاف المسابقة (للمشرفين)
                                `,
                                },
                                {
                                    name: "🏆 **أوامر المسابقة**",
                                    value: `
                                    - \`/score\`: عرض أفضل 10 لاعبين
                                    - \`/help\`: عرض هذه الرسالة
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

                        await interaction.editReply({
                            embeds: [helpEmbed],
                        });
                        break;

                    } catch (err) {
                        console.error("Help command failed:", err);
                        interaction.editReply({
                            content: "❌ حدث خطأ أثناء عرض المساعدة!",
                        });
                    }
                    break;

                case "reset":
                    if (!isAdmin(member)) {
                        return interaction.editReply({
                            content: "❌ ليس لديك صلاحية استخدام هذا الأمر!",
                        });
                    }

                    server.scores = {};
                    saveData();
                    interaction.editReply("🔄 تم إعادة تعيين النقاط للجميع!");
                    break;

                // case "invite":
                //     try {
                //         const inviteEmbed = new EmbedBuilder()
                //             .setTitle("🔗 دعوة البوت إلى سيرفرك!")
                //             .setDescription(
                //                 `[انقر هنا لإضافة البوت إلى سيرفرك](${generateInviteLink()})`,
                //             )
                //             .setColor("#7289DA")
                //             .setFooter({ text: "شكراً لدعمك!" });

                //         await interaction.editReply({
                //             embeds: [inviteEmbed],
                //         });
                //         break;

                //     } catch (err) {
                //         console.error("Invite command failed:", err);
                //         interaction.editReply({
                //             content: "❌ حدث خطأ أثناء إنشاء رابط الدعوة!",
                //         });
                //     }
                //     break;
            }
        } catch (error) {
            console.error(`Error handling /${interaction.commandName}:`, error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "❌ حدث خطأ أثناء تنفيذ الأمر!",
                }).catch(console.error);
            }
        }
    } catch (error) {
        console.error(`Error handling /${commandName}:`, error);
        if (!interaction.replied) {
            interaction.editReply({
                content: "❌ حدث خطأ أثناء تنفيذ الأمر!",
            }).catch(console.error);
        }
    }
});

// Message handling
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;
        if (!message.guild) return;
        if (!message.channel) return;

        const serverId = message.guild.id;
        const server = initServer(serverId);

        // Handle answers to questions (remove the ! prefix check)
        if (server.currentQuestion && String(message.channel.id) === String(server.quizChannel)) {
            console.log("Answer detection started for message:", message.content);

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

function generateInviteLink() {
    return `https://discord.com/oauth2/authorize?client_id=${config.clientId}&permissions=277025770560&scope=bot%20applications.commands`;
}

// Start the bot (this is your existing line)
client.login(config.token).catch((err) => {
    console.error("Failed to login:", err);
    process.exit(1);
});
