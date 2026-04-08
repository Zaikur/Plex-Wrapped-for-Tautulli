<p align="center">
<img width="506" height="82" alt="Image" src="https://github.com/user-attachments/assets/3e56ec29-2d5c-4845-9c80-35ced932a246" /><br>
   <a href="https://github.com/netplexflix/Plex-Wrapped-for-Tautulli/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/netplexflix/Plex-Wrapped-for-Tautulli?style=plastic"></a>
   <a href="https://hub.docker.com/repository/docker/netplexflix/pwft"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/netplexflix/pwft?style=plastic"></a>
   <a href="https://discord.gg/VBNUJd7tx3"><img alt="Discord" src="https://img.shields.io/discord/1329439972796928041?style=plastic&label=Discord"></a>
</p> 
<br><br>

A year-in-review wrapped report for your Plex server, powered by Tautulli data. Self hosted with Docker.<br>
Beautiful, animated/dynamic statistics and fun facts. With exportable slides for social media sharing.

<img src="https://github.com/user-attachments/assets/2b71e3c1-5d84-4e80-96cb-2e32ded3cf4c" width="15%"></img> <img src="https://github.com/user-attachments/assets/017012e4-ae19-43f5-8f2f-d3b7e7ff911e" width="15%"></img> <img src="https://github.com/user-attachments/assets/9d5f2bfe-743d-4e07-b21e-2c3f02b2535e" width="15%"></img> <img src="https://github.com/user-attachments/assets/ec98307f-ff31-47af-aa7d-ee34277e7575" width="15%"></img> <img src="https://github.com/user-attachments/assets/151f7141-2dc2-4aa2-b498-bdc4093666be" width="15%"></img><br>
<img src="https://github.com/user-attachments/assets/2fa4ba72-d68f-4503-a666-c73b50bc8b31" width="15%"></img> <img src="https://github.com/user-attachments/assets/8129bf9a-3dfa-40ba-840f-29cebd0f1df6" width="15%"></img> <img src="https://github.com/user-attachments/assets/c0a67005-1c9a-40eb-a0a4-5e0acf016e34" width="15%"></img> <img src="https://github.com/user-attachments/assets/4d128df8-3ce4-4a86-ae8a-5aae8eb771c4" width="15%"></img> <img src="https://github.com/user-attachments/assets/0671b81d-01e3-4816-a7c7-5ba43eb31dca" width="15%"></img>

A few examples of what it looks like on mobile:<br>
<img src="https://github.com/user-attachments/assets/31ba5ac0-735e-4706-860b-ac57c6329121" width="25%"></img>


### Prerequisites
- Docker and Docker Compose installed
- A running Tautulli instance
- Plex accounts must be able to sign in through plex.tv

### Quick Start
1. Download the `docker-compose.yml` file from this repository
2. Pull the latest image:
```bash
docker-compose pull
```

3. Start the container:
```bash
docker-compose up -d
```

## Configuration
### Tautulli Connection

1. Access the app at `http://localhost:2025`.
2. Sign in with Plex. The first successful Plex login claims the admin account for this installation.
3. Open the Admin Panel with that admin Plex account.
4. Enter your Tautulli `IP:PORT` and API Key (Find this in Tautulli → Settings → Web Interface → API Key)

### Authentication

- Admin access is bound to a single Plex account.
- Regular users sign in with Plex and can only view their own wrapped report.
- Plex users are matched to Tautulli users by username by default.
- If a Plex username and Tautulli username do not match, add an override in the Admin Panel `Users` tab.

### Optional Settings

- **Custom Logo:** Upload your custom logo to be used in reports and export slides. You can adjust the size with the slider.
- **Custom Title:** Use a custom title instead of "Plex Wrapped".
- **Normalize Tautulli Anomalies:** Fixes duration anomalies found in Tautulli history by capping watch times to actual runtime.
> [!NOTE]
> When not closed correctly, sessions in Tautulli can keep 'counting', resulting in sometimes days or weeks worth of 'watch history' for a single session.
> This option detects such anomalies and normalizes the session durations to the runtime of the item that was watched.
> To check if you have such anomalies you can check your history tab in Tautulli and sort by duration and look for unrealistically high values:
> 
> <img width="1916" height="316" alt="image" src="https://github.com/user-attachments/assets/6fe10045-d270-42f7-8c7a-cd76ac585f4b" />
- **Streaming Locations:** Will show a world map of where streaming sessions originated from.
- **Show Leaderboard:** Will show a user leaderboard in the "All Users" web report.

## Build a Cache
The app builds and uses a cache file for faster report generation.<br>
After initial setup, it's highly recommended to generate a report for `All Users` for `All Time` from the admin account. Depending on your history, this can take quite some time.
Once completed, subsequent reports will generate consciderably faster especially if you enabled `Normalize Tautulli Anomalies`.

## Export Slides
In the Admin Panel you can export individual user reports.<br>

- `Full Image` exports one long report with all stats.
- `Story Slides` exports nine 9:16 slides for social media reels.
- You can select multiple users at a time.
- Users will see an `Export Slides` button at the bottom of the web version of their wrapped report to quickly export their own slides.

<img width="815" height="686" alt="Image" src="https://github.com/user-attachments/assets/cbc9bc2f-7676-41bd-96a9-781eeb9a2f6b" />

### ⚠️ **Do you Need Help or have Feedback?**
- Join the [Discord](https://discord.gg/VBNUJd7tx3).
 
---  
### ❤️ Support the Project
If you like this project, please ⭐ star the repository and share it with the community!

<br/>

[!["Buy Me A Coffee"](https://github.com/user-attachments/assets/5c30b977-2d31-4266-830e-b8c993996ce7)](https://www.buymeacoffee.com/neekokeen)