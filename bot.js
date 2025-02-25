require('dotenv').config(); // Load environment variables
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs'); // Import the fs module to read files
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const token = process.env.BOT_TOKEN; // Load token from .env file

// Load questions from questions.json
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));

let currentQuestion = null;
const scores = new Map();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    postDailyQuestion(); // Post the first question immediately
    setInterval(postDailyQuestion, 5 * 60 * 1000); // Post a question every 5 minutes
});

function postDailyQuestion() {
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    currentQuestion = randomQuestion;

    // Create buttons for each option
    const buttons = randomQuestion.options.map((option, index) =>
        new ButtonBuilder()
            .setCustomId(`answer_${index}`)
            .setLabel(option) // Display the actual answer text
            .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    // Create an embed
    const embed = new EmbedBuilder()
        .setTitle('🎌 سؤال الأنمي اليومي 🎌')
        .setDescription(randomQuestion.question)
        .setColor('#FFD700') // Gold color
        .setThumbnail('https://i.imgur.com/xyz123.png') // Add an anime-related thumbnail
        .addFields(
            { name: 'الوقت المتبقي', value: 'دقيقة واحدة ⏳', inline: true },
            { name: 'النقاط', value: 'اضغط على الإجابة الصحيحة لربح النقاط!', inline: true }
        )
        .setFooter({ text: 'أنمي كويز بوت', iconURL: 'https://i.imgur.com/xyz123.png' }) // Add a footer with an icon
        .setTimestamp(); // Add a timestamp

    // Send the embed with buttons
    client.channels.cache.get('1343967209604517990').send({ embeds: [embed], components: [row] });

    // Set a 30-second timer to end the answering window
    setTimeout(() => {
        if (currentQuestion) {
            const answerEmbed = new EmbedBuilder()
                .setTitle('⏰ انتهى الوقت! ⏰')
                .setDescription(`الإجابة الصحيحة هي: **${currentQuestion.correctAnswer}**`)
                .setColor('#FF0000') // Red color
                .setFooter({ text: 'أنمي كويز بوت', iconURL: 'https://i.imgur.com/xyz123.png' })
                .setTimestamp();
            client.channels.cache.get('1343967209604517990').send({ embeds: [answerEmbed] });
            currentQuestion = null; // Reset the question
        }
    }, 60000); // 60 seconds
}

// Handle button clicks
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const answerIndex = interaction.customId.split('_')[1];
    const correctAnswer = currentQuestion.correctAnswer;
    const options = currentQuestion.options;

    if (options[answerIndex] === correctAnswer) {
        await interaction.reply({ content: 'إجابة صحيحة! 🎉', ephemeral: true });
        const userScore = scores.get(interaction.user.id) || 0;
        scores.set(interaction.user.id, userScore + 1);

        // Highlight the correct answer
        const buttons = options.map((option, index) =>
            new ButtonBuilder()
                .setCustomId(`answer_${index}`)
                .setLabel(option)
                .setStyle(index === answerIndex ? ButtonStyle.Success : ButtonStyle.Secondary) // Highlight correct answer
                .setDisabled(true) // Disable buttons after answering
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        await interaction.message.edit({ components: [row] }); // Update the message with disabled buttons
        currentQuestion = null; // Reset the question
    } else {
        await interaction.reply({ content: 'إجابة خاطئة! حاول مرة أخرى.', ephemeral: true });
    }
});

// Leaderboard command
client.on('messageCreate', (message) => {
    if (message.content === '!الترتيب') {
        const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1]);
        const leaderboard = sortedScores.map(([userId, score], index) => `**${index + 1}.** <@${userId}>: ${score} نقاط`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 لوحة المتصدرين 🏆')
            .setDescription(leaderboard || 'لا توجد نقاط حتى الآن!')
            .setColor('#00FF00') // Green color
            .setFooter({ text: 'أنمي كويز بوت', iconURL: 'https://i.imgur.com/xyz123.png' })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

// Help command
client.on('messageCreate', (message) => {
    if (message.content === '!مساعدة') {
        const embed = new EmbedBuilder()
            .setTitle('🛠️ مساعدة أنمي كويز بوت 🛠️')
            .setDescription(`
                **كيفية استخدام البوت:**
                - سيتم نشر سؤال أنمي كل 5 دقائق.
                - اضغط على الزر المناسب للإجابة.
                - لديك دقيقة واحدة للإجابة على كل سؤال.
                - استخدم \`!الترتيب\` لرؤية أفضل اللاعبين.
            `)
            .setColor('#00BFFF') // Blue color
            .setFooter({ text: 'أنمي كويز بوت', iconURL: 'https://i.imgur.com/xyz123.png' })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

client.login(token);