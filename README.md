# 🎌 Anime Quiz Discord Bot

A customizable Arabic anime quiz bot for Discord servers that posts daily questions, tracks scores, and manages competitions.

![Bot Preview](https://static.wikia.nocookie.net/frieren/images/9/96/Himmel_anime_portrait.png/revision/latest?cb=20231017083515)

## ✨ Features

- **Daily Anime Questions**  
  Posts timed trivia questions with images
- **Multi-Server Support**  
  Works across multiple Discord servers simultaneously
- **Leaderboard System**  
  Tracks user scores with `!score` command
- **Admin Controls**  
  Start/stop quizzes and reset scores
- **Arabic Language Support**  
  Fully Arabic interface with RTL formatting
- **Answer Detection**  
  Recognizes Arabic text variations and punctuation

## 🛠 Setup Guide

### Prerequisites

- Node.js v16+
- Discord Bot Token ([Get one here](https://discord.com/developers/applications))
- Server with required permissions

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/anime-quiz-bot.git
   cd anime-quiz-bot
   
2. Install dependencies:
npm install

3. Create .env file:
BOT_TOKEN=your_discord_bot_token_here
ADMIN_USERS=admin_user_id_1,admin_user_id_2

4. Add your questions to questions.json:
[
  {
    "question": "ما هو اسم السيف الأسطوري في بيرسيرك؟",
    "correctAnswer": "دراغون سلاير",
    "image": "https://example.com/berserk_sword.jpg"
  }
]

5. Start the bot:
node bot.js

##🤖 Bot Commands

Command	Description	Permission
!setup	Set quiz channel	Admin
!start	Start daily questions	Admin
!stop	Stop the quiz	Admin
!score	Show leaderboard	Everyone
!help	Show command list	Everyone
!reset	Reset all scores	Admin

##🔗 Invite the Bot
Use this link to add the bot to your server:
Invite Link

###Required permissions:

Send Messages
Embed Links
Add Reactions
Read Message History

##🚀 Deployment

PM2 (Recommended)
npm install pm2 -g
pm2 start bot.js --name anime-quiz
pm2 save
pm2 startup

Docker
docker build -t anime-quiz-bot .
docker run -d --name anime-bot --env-file .env anime-quiz-bot
📝 Customization
Questions: Edit questions.json

Timing: Modify in config:

defaultCooldown: 30, // Seconds between questions
questionDuration: 10 // Seconds to answer
Appearance: Edit embed colors/styles in bot.js

📜 License
MIT License - See LICENSE for details

Note: Make sure your bot has the proper permissions in your Discord server's channel settings.

Copy

### Key Sections Included:
1. **Visual header** with anime image
2. **Feature highlights** in bullet points
3. **Step-by-step setup** instructions
4. **Command reference** table
5. **Permission requirements**
6. **Deployment options** (PM2/Docker)
7. **Customization guide**
8. **License information**

### Recommended Additions:
1. Add actual screenshots in a `/previews` folder
2. Replace `YOUR_BOT_ID` with your actual bot ID
3. Include a contributors section if applicable
4. Add a troubleshooting section with common issues
