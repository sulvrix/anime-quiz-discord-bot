# 🎌 Anime Quiz Discord Bot  

<div align="center">
  <img src="https://static.wikia.nocookie.net/frieren/images/9/96/Himmel_anime_portrait.png/revision/latest?cb=20231017083515" width="200" alt="Bot Icon">
  <p><em>A customizable Arabic anime quiz bot for Discord servers</em></p>
</div>

---

## ✨ Features  

| Feature | Description |  
|---------|-------------|  
| **Daily Questions** | Posts timed trivia questions with anime images |  
| **Multi-Server** | Works across unlimited Discord servers |  
| **Arabic Support** | Full RTL support with Arabic text normalization |  
| **Leaderboards** | Tracks scores with `!score` command |  
| **Admin Controls** | Start/stop quizzes and reset scores |  

---

## 🚀 Quick Start  

### Requirements  
- Node.js 16+  
- Discord bot token  
- Server with [these permissions](#-permissions)  

## Installation  
### Clone the repository
```bash
git clone https://github.com/yourusername/anime-quiz-bot.git
cd anime-quiz-bot
```
### Install dependencies
npm install

### Configure environment
cp .env.example .env

### Edit the .env file with your credentials
BOT_TOKEN=your_token_here\
ADMIN_USERS=admin1_id,admin2_id  # Discord user IDs

### Add questions in questions.json:
```json
[
  {
    "question": "ما اسم السيف الأسطوري في بيرسيرك؟",
    "correctAnswer": "دراغون سلاير",
    "image": "https://example.com/sword.jpg"
  }
]
```
### Start the bot:
node bot.js

## 🎮 Commands

### For Everyone
| Command  | Description          | Example |
|----------|----------------------|---------|
| `!help`  | Show command help    | `!help` |
| `!score` | View leaderboard     | `!score` |

### For Admins
| Command  | Description          | Example |
|----------|----------------------|---------|
| `!setup` | Set quiz channel     | `!setup` |
| `!start` | Start the quiz       | `!start` |
| `!stop`  | Stop the quiz        | `!stop` |
| `!reset` | Reset all scores     | `!reset` |

## 🔐 Permissions:
Required bot permissions:
+ View Channels  
+ Send Messages  
+ Embed Links  
+ Add Reactions  
+ Read Message History

<p><a href="https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&amp;permissions=277025770560&amp;scope=bot" target="_blank" rel="noreferrer">Generate Invite Link</a></p>

## 🛠 Advanced:
### Deployment Options:
- PM2 (Recommended)
```bash
npm install pm2 -g
pm2 start bot.js --name anime-quiz
pm2 save
pm2 startup
```

- Docker
```bash
FROM node:16
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "bot.js"]
```

## Customization:
1. Timing Settings:
```json
// In config:
defaultCooldown: 30,  // Seconds between questions
questionDuration: 10  // Answer time window
```
2. Appearance:
Edit embed colors in bot.js:
```json
.setColor("#FFD700") // Gold for questions
.setColor("#FF0000") // Red for timeouts
```

## ❓ Troubleshooting:
| Issue                  | Solution                                  |
|------------------------|-------------------------------------------|
| Missing permissions    | Re-invite bot with [correct permissions](#-permissions) |
| Answers not detected   | Check normalization in `questions.json`   |
| Bot not responding     | Verify token in `.env` is correct         |

## 📜 License:
MIT © 2025 Sulvrix
