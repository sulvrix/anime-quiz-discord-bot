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
//t

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
            .setLabel(`الخيار ${index + 1}`)
            .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    // Create an embed
    const embed = new EmbedBuilder()
        .setTitle('سؤال الأنمي اليومي 🎌')
        .setDescription(randomQuestion.question)
        .setColor('#FFD700')
        .setFooter({ text: 'لديك 30 ثانية للإجابة! ⏳' });

    // Send the embed with buttons
    client.channels.cache.get('1343967209604517990').send({ embeds: [embed], components: [row] });

    // Set a 30-second timer to end the answering window
    setTimeout(() => {
        if (currentQuestion) {
            const answerEmbed = new EmbedBuilder()
                .setTitle('انتهى الوقت! ⏰')
                .setDescription(`الإجابة الصحيحة هي: **${currentQuestion.correctAnswer}**`)
                .setColor('#FF0000');
            client.channels.cache.get('1343967209604517990').send({ embeds: [answerEmbed] });
            currentQuestion = null; // Reset the question
        }
    }, 30000); // 30 seconds
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
        currentQuestion = null; // Reset the question
    } else {
        await interaction.reply({ content: 'إجابة خاطئة! حاول مرة أخرى.', ephemeral: true });
    }
});

client.login(token);