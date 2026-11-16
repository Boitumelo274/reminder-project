# Remindr

Reminders, repeats and weekly or monthly goals. Plain HTML, CSS and JavaScript. Installs on your phone as an app.

## Put it online with GitHub Pages

1. On github.com create a new **public** repository named `remindr`.
2. Upload every file from this folder (index.html, style.css, app.js, sw.js, manifest.webmanifest, both icons) to the repository root.
3. Repository **Settings > Pages > Build and deployment**: Source = _Deploy from a branch_, Branch = `main`, folder = `/ (root)`, then Save.
4. After a minute the app is at `https://<your-username>.github.io/remindr/`.

Or with git:

```
git init && git add . && git commit -m "Remindr"
git branch -M main
git remote add origin https://github.com/<your-username>/remindr.git
git push -u origin main
```

## Install on your phone

- **Android (Chrome):** open the link, tap ⋮, then _Install app_. Then open the app, go to More and tap _Allow notifications_.
- **iPhone (Safari, iOS 16.4+):** open the link, tap Share, then _Add to Home Screen_. Open it from the home screen, go to More and tap _Allow notifications_.

## Notes

- Data is stored on the device. Use More > Export backup to keep a copy.
- Notifications fire while the app is open or recently used. Android Chrome can also wake an installed app periodically to check. Fully reliable alerts with the app closed need a push server or a native app.
