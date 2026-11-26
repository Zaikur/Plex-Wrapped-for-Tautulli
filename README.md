<p align="center">
<img width="506" height="82" alt="Image" src="https://github.com/user-attachments/assets/3e56ec29-2d5c-4845-9c80-35ced932a246" /><br>
   <a href="https://github.com/netplexflix/Plex-Wrapped-for-Tautulli/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/netplexflix/Plex-Wrapped-for-Tautulli?style=plastic"></a>
   <a href="https://hub.docker.com/repository/docker/netplexflix/pwft"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/netplexflix/pwft?style=plastic"></a>
   <a href="https://discord.gg/VBNUJd7tx3"><img alt="Discord" src="https://img.shields.io/discord/1329439972796928041?style=plastic&label=Discord"></a>
</p> 
<br><br>

A year-in-review wrapped report for your Plex server (Movies and TV Shows), powered by Tautulli data. Self hosted with Docker.<br>
Beautiful, animated/dynamic statistics and fun facts. With exportable slides for social media sharing.<br>
Customizable with several themes, own logo, title, etc.

<img src="https://github.com/user-attachments/assets/6eb01ee8-c0ba-45c2-90be-f999184a668a" width="15%"></img> <img src="https://github.com/user-attachments/assets/a2b30372-c4bd-439e-8dd0-45b45f370b55" width="15%"></img> <img src="https://github.com/user-attachments/assets/df383ceb-0f11-4639-92d0-9de40ef96272" width="15%"></img> <img src="https://github.com/user-attachments/assets/6ca9787a-2b33-4625-b9fc-44ec1adce211" width="15%"></img>
<img src="https://github.com/user-attachments/assets/53461778-9be1-4b8a-a1d0-e915c9e810a9" width="15%"></img><br>
<img src="https://github.com/user-attachments/assets/a7573bf9-0c51-4df5-9336-6e6efd030a26" width="15%"></img> <img src="https://github.com/user-attachments/assets/70340edf-6444-45c0-a0dd-4a1c682d49e5" width="15%"></img> <img src="https://github.com/user-attachments/assets/4c330b50-5e07-4bd0-b875-8ebfa8896369" width="15%"></img> <img src="https://github.com/user-attachments/assets/35327d50-3bb7-465b-9ed6-3566fd7f8fba" width="15%"></img> <img src="https://github.com/user-attachments/assets/4db2179c-0c29-4658-904c-fb4588b1de43" width="15%"></img>

Example of what it looks like on mobile:<br>
<img src="https://github.com/user-attachments/assets/31ba5ac0-735e-4706-860b-ac57c6329121" width="25%"></img>


### Prerequisites
- Docker and Docker Compose installed
- A running Tautulli instance

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
2. Sign in with Plex. The first successful login claims the admin account for this installation. Existing installations keep their admin Plex account.
3. Open the Admin Panel with that account.
4. Enter your Tautulli `IP:PORT` and API Key (Find this in Tautulli → Settings → Web Interface → API Key)

### Authentication

- Admin access is bound to a single Plex account. Only the admin can view other users or combined reports.
- Regular users sign in with Plex and can only view their own report.
- Plex users match Tautulli users by username, ignoring case. If the names differ, add an override in the Admin Panel's Users tab.
- Existing admin ownership, Plex client identifier and user mapping overrides are migrated automatically. Existing sessions require signing in again after upgrading.

### Customization
<img width="1800" height="337" alt="Image" src="https://github.com/user-attachments/assets/1c62a848-e901-434d-9777-ccdfa3033af3" />

- **Theme:** Default, Plex Gold, Midnight Frost, VHS Rewind and Rental Night.
- **Custom Logo:** Upload your custom logo to be used in reports and export slides. You can adjust the size with the slider.
- **Custom Title:** Use a custom title instead of "Plex Wrapped".
- **Installable App:** Set the name and icon the app gets when visitors install it (see below).
- **Background Music:** Visitors can play a song with the speaker button in the corner. Upload your own song (MP3, M4A, AAC, OGG, WAV or FLAC, up to 20MB) or use the default Christmas song. Optionally have it **Start Unmuted**.
- **Unwrap Sound:** The sound played when visitors unwrap their top movie and show. (Gift or VHS box, depending on the theme). Upload your own sound, or use the default.

### Optional Settings

- **Normalize Tautulli Anomalies:** Fixes duration anomalies found in Tautulli history by capping watch times to actual runtime.
> [!NOTE]
> When not closed correctly, sessions in Tautulli can keep 'counting', resulting in sometimes days or weeks worth of 'watch history' for a single session.
> This option detects such anomalies and normalizes the session durations to the runtime of the item that was watched.
> To check if you have such anomalies you can check your history tab in Tautulli and sort by duration and look for unrealistically high values:
> 
> <img width="1916" height="316" alt="image" src="https://github.com/user-attachments/assets/6fe10045-d270-42f7-8c7a-cd76ac585f4b" />
- **Streaming Locations:** Will show a globe of where streaming sessions originated from. Click on a location to see most recent sessions (admin only).
- **Show Leaderboard:** Will show a user leaderboard in the "All Users" web report.
- **Show Viewer Ranking:** Tells viewers in the top half how their watch time ranks on your server (e.g. "You watched more than 82% of viewers on this server"). Viewers in the bottom half don't see a ranking.
- **Default Year:** Reports open by default on the previous year until this date (December 1st by default), then on the current year. Visitors can always pick another year from the settings.



## Install as an App
Plex Wrapped can be installed as a Progressive Web App (PWA) on phones, tablets and computers, so it opens from the home screen like a regular app.

- **Android / Chrome / Edge:** use the browser's *Install app* option, or `Settings` → `Install app` in the report.
- **iPhone / iPad:** tap *Share*, then *Add to Home Screen*.
- In the Admin Panel (`Settings` tab → `Installable App`) you can set the **App Name** (defaults to the title) and upload an **App Icon**. The icon is resized automatically; a square image of at least 512×512 works best.

> [!NOTE]
> Browsers only offer to install sites served over HTTPS, so put Plex Wrapped behind a reverse proxy with a certificate. (e.g. [Caddy](https://caddyserver.com/))

## Stats Cache
The server keeps a local copy of your Tautulli history, together with item metadata and streaming locations, in the `/data` folder. Reports are computed from this cache, so they load in seconds.
The first start after connecting Tautulli builds the cache. Caching the metadata of every title you ever watched can take longer on large servers. You can check the progress in the Cache tab.
Caches are automatically updated nightly.

## Export Slides
In the Admin Panel you can export individual user reports.<br>

- `Full Image` exports one long report with all stats.
- `Story Slides` exports nine 9:16 slides for social media reels.
- You can select multiple users at a time.
- Users will see an `Export Slides` button at the bottom of the web version of their wrapped report to quickly export their own slides.

### ⚠️ **Do you Need Help or have Feedback?**
- Join the [Discord](https://discord.gg/VBNUJd7tx3).
 
---  
### ❤️ Support the Project
If you like this project, please ⭐ star the repository and share it with the community!

<br/>

[!["Buy Me A Coffee"](https://github.com/user-attachments/assets/5c30b977-2d31-4266-830e-b8c993996ce7)](https://www.buymeacoffee.com/neekokeen)