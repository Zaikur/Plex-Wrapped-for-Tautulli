<img width="1000" height="125" alt="{629815CE-B46B-4C07-88DE-0AD07B93A112}" src="https://github.com/user-attachments/assets/32fd275f-e882-4e33-8a26-672ecedbe04c" />


# Plex Wrapped for Tautulli

A year-in-review wrapped report for your Plex server, powered by Tautulli data. Self hosted with Docker.<br>
Beautiful, animated/dynamic wrapped-style statistics and fun facts. With exportable slides for social media sharing.

<img src="https://github.com/user-attachments/assets/fd762b10-9b83-40b9-a3b2-e2924ad90d92" width="15%"></img> <img src="https://github.com/user-attachments/assets/6e286878-2f68-4396-81ed-f16ba2bc4a0d" width="15%"></img> <img src="https://github.com/user-attachments/assets/5d72e56d-24b9-4704-8b40-42177e2fbfdc" width="15%"></img> <img src="https://github.com/user-attachments/assets/9b0456d3-43a4-4338-864d-fcb0acd51297" width="15%"></img><br>
<img src="https://github.com/user-attachments/assets/f61319c3-f5a8-4895-9468-510c80cf11cf" width="15%"></img> <img src="https://github.com/user-attachments/assets/1b4b2e11-c3b6-42e3-b61b-ff18cd250889" width="15%"></img> <img src="https://github.com/user-attachments/assets/2c914378-ceb4-4d33-a45f-16df504d6c11" width="15%"></img> <img src="https://github.com/user-attachments/assets/491d5980-6e95-420b-91d4-3e0bd21e7a43" width="15%"></img>

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
2. Open the Admin Panel and set your Admin password
3. Enter your Tautulli `IP:PORT` and API Key (Find this in Tautulli → Settings → Web Interface → API Key)

### Optional Settings

- **Custom Title:** Use a custom title instead of "Plex Wrapped".
- **Discreet Mode:** Replaces the user dropdown with a username input field. Users need to enter their exact username. (NOT 'Friendly name')
- **Password Protect Users:** Generates passwords for each user. (See `Users`Tab)
- **Normalize Tautulli Anomalies:** Fixes duration anomalies found in Tautulli history by capping watch times to actual runtime.
> [!NOTE]
> When not closed correctly, sessions in Tautulli can keep 'counting', resulting in sometimes days or weeks worth of 'watch history' for a single session.
> This option detects such anomalies and normalizes the session durations to the runtime of the item that was watched.
> To check if you have such anomalies you can check your history tab in Tautulli and sort by duration and look for unrealistically high values:
> 
> <img width="1916" height="316" alt="image" src="https://github.com/user-attachments/assets/6fe10045-d270-42f7-8c7a-cd76ac585f4b" />

## Build a Cache
The app builds and uses a cache file for faster report generation.<br>
On your first use, it's highly recommended to generate a report for `All Users` for `All Time`. Depending on your history, this can take quite some time.
Once completed, subsequent reports will generate consciderably faster especially if you enabled `Normalize Tautulli Anomalies`.

## Export Slides
In the Admin Panel you can export individual user reports.<br>

- `Full Image` exports one long report with all stats.
- `Story Slides` exports nine 9:16 slides for social media reels.
- You can select multiple users at a time.
- Users will see an `Export Slides` button at the bottom of the web version of their wrapped report to quickly export their own slides.

<img width="872" height="711" alt="image" src="https://github.com/user-attachments/assets/f78f5fc6-1d50-47d0-bd23-f2913adf729a" />

### ⚠️ **Do you Need Help or have Feedback?**
- Join the [Discord](https://discord.gg/VBNUJd7tx3).
 
---  
### ❤️ Support the Project
If you like this project, please ⭐ star the repository and share it with the community!

<br/>

[!["Buy Me A Coffee"](https://github.com/user-attachments/assets/5c30b977-2d31-4266-830e-b8c993996ce7)](https://www.buymeacoffee.com/neekokeen)

