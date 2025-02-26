require("dotenv").config(); // Load environment variables
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const fs = require("fs"); // Import the fs module to read files
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const token = process.env.BOT_TOKEN; // Load token from .env file

// Load questions from questions.json
const questions = JSON.parse(fs.readFileSync("questions.json", "utf-8"));

let currentQuestion = null;
const scores = new Map();
const answeredUsers = new Set(); // Track users who have answered


client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    postDailyQuestion(); // Post the first question immediately
    setInterval(postDailyQuestion, 3 * 60 * 1000); // Post a question every 3 minutes
});

function postDailyQuestion() {
    //if (!isWithinActiveTimeRange()) {
    //    console.log("Not within active time range. Skipping question.");
    //    return;
    //}

    const randomQuestion =
        questions[Math.floor(Math.random() * questions.length)];
    currentQuestion = randomQuestion;
    answeredUsers.clear(); // Reset answered users for the new question

    // Create buttons for each option
    const buttons = randomQuestion.options.map((option, index) =>
        new ButtonBuilder()
            .setCustomId(`answer_${index}`)
            .setLabel(option) // Display the actual answer text
            .setStyle(ButtonStyle.Primary),
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    // Create an embed with RTL text and image
    const embed = new EmbedBuilder()
        .setTitle("\u200F🎌 سؤال الأنمي اليومي 🎌") // RTL mark + reversed text
        .setDescription("\u200F" + randomQuestion.question) // RTL mark
        .setColor("#FFD700") // Gold color
        .setThumbnail("https://i.imgur.com/56Bu3l9.png") // Updated image URL
        .setImage(randomQuestion.image) // Add the question image
        .addFields(
            { name: "\u200B", value: "\u200B", inline: false }, // Invisible spacer field
        )
        .addFields(
            {
                name: "\u200Fالوقت المتبقي",
                value: "\u200F⏳ 30 ثانية",
                inline: false,
            }, // RTL mark + reversed text
            {
                name: "\u200Fالنقاط",
                value: "\u200F!اضغط على الإجابة الصحيحة",
                inline: false,
            }, // RTL mark + reversed text
        )
        .addFields(
            { name: "\u200B", value: "\u200B", inline: false }, // Invisible spacer field
        )
        .setFooter({
            text: "\u200Fأنمي كويز بوت",
            iconURL: "https://i.imgur.com/56Bu3l9.png",
        }) // Updated image URL
        .setTimestamp(); // Add a timestamp

    // Send the embed with buttons
    client.channels.cache
        .get("1343357167528448081")
        .send({ embeds: [embed], components: [row] });

    // Set a 30-second timer to end the answering window
    setTimeout(() => {
        if (currentQuestion) {
            const answerEmbed = new EmbedBuilder()
                .setTitle("\u200F⏰ انتهى الوقت ⏰") // RTL mark + reversed text
                .setDescription(
                    "\u200F" +
                    `الإجابة الصحيحة هي: **${currentQuestion.correctAnswer}**`,
                ) // RTL mark
                .setColor("#FF0000") // Red color
                .setFooter({
                    text: "\u200Fأنمي كويز بوت",
                    iconURL: "https://i.imgur.com/56Bu3l9.png",
                }) // Updated image URL
                .setTimestamp();
            client.channels.cache
                .get("1343357167528448081")
                .send({ embeds: [answerEmbed] });
            currentQuestion = null; // Reset the question
        }
    }, 30000); // 30 seconds
}

// Handle button clicks
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    // Check if the user has already answered
    if (answeredUsers.has(interaction.user.id)) {
        await interaction.reply({
            content: "لقد أجبت بالفعل على هذا السؤال!",
            flags: 64,
        }); // Ephemeral
        return;
    }

    const answerIndex = interaction.customId.split("_")[1];
    const correctAnswer = currentQuestion.correctAnswer;
    const options = currentQuestion.options;

    if (options[answerIndex] === correctAnswer) {
        await interaction.reply(`<@${interaction.user.id}> أجاب بشكل صحيح! 🎉`);
        const userScore = scores.get(interaction.user.id) || 0;
        scores.set(interaction.user.id, userScore + 1);

        // Highlight the correct answer
        const buttons = options.map(
            (option, index) =>
                new ButtonBuilder()
                    .setCustomId(`answer_${index}`)
                    .setLabel(option)
                    .setStyle(
                        index === answerIndex
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary,
                    ) // Highlight correct answer
                    .setDisabled(true), // Disable buttons after answering
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        await interaction.message.edit({ components: [row] }); // Update the message with disabled buttons
        currentQuestion = null; // Reset the question
    } else {
        await interaction.reply({
            content: "إجابة خاطئة! لا يمكنك الإجابة مرة أخرى.",
            flags: 64,
        }); // Ephemeral
        answeredUsers.add(interaction.user.id); // Prevent the user from answering again
    }
});

// Leaderboard command
client.on("messageCreate", (message) => {
    if (message.content === "!الترتيب") {
        const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1]);
        const leaderboard = sortedScores
            .map(
                ([userId, score], index) =>
                    `**${index + 1}.** <@${userId}>: ${score} نقاط`,
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle("🏆 لوحة المتصدرين 🏆")
            .setDescription(leaderboard || "لا توجد نقاط حتى الآن!")
            .setColor("#00FF00") // Green color
            .setFooter({
                text: "أنمي كويز بوت",
                iconURL: "https://i.imgur.com/56Bu3l9.png",
            }) // Updated image URL
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// Help command
client.on("messageCreate", (message) => {
    if (message.content === "!مساعدة") {
        const embed = new EmbedBuilder()
            .setTitle("🛠️ مساعدة أنمي كويز بوت 🛠️")
            .setDescription(
                `
                **كيفية استخدام البوت:**
                - سيتم نشر سؤال أنمي كل 3 دقائق.
                - اضغط على الزر المناسب للإجابة.
                - لديك 30 ثانية للإجابة على كل سؤال.
                - استخدم \`!الترتيب\` لرؤية أفضل اللاعبين.
            `,
            )
            .setColor("#00BFFF") // Blue color
            .setFooter({
                text: "أنمي كويز بوت",
                iconURL: "https://i.imgur.com/56Bu3l9.png",
            }) // Updated image URL
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// Admin command to force a question (using multiple role IDs)
client.on("messageCreate", async (message) => {
    if (message.content === "!سؤال") {
        // Replace with your allowed role IDs
        const allowedRoleIds = ["1322237538232172568", "1342591205455954012"]; // Example: ['123456789012345678', '987654321098765432']
        const hasAllowedRole = allowedRoleIds.some((roleId) =>
            message.member.roles.cache.has(roleId),
        );

        if (hasAllowedRole) {
            // Force post a question
            postDailyQuestion();
        }
    }
});

client.login(token);
