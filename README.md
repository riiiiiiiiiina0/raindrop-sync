# 💦 Raindrop Sync

A Chrome extension that **automatically syncs your [Raindrop.io](https://raindrop.io/) bookmarks to Chrome daily**—no manual export required.

![](./docs/poster.jpeg)

<a href="https://buymeacoffee.com/riiiiiiiiiina" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## ⭐ Key Features

### 🔄 **Automatic Synchronization**

- **Daily auto-sync**: Your Raindrop.io bookmarks automatically sync to Chrome every day
- **Flexible scheduling**: Choose from hourly, daily, or weekly backup frequencies
- **Manual backup**: Start an immediate sync whenever you need it

### 🛡️ **Reliable & Robust**

- **Background processing**: Syncs happen seamlessly in the background without interrupting your browsing
- **Persistent state**: Resumes interrupted backups automatically if your browser restarts
- **Error recovery**: Smart timeout handling and backup process recovery
- **Status notifications**: Real-time progress updates and completion notifications

### 🔒 **Secure & Private**

- **Local processing**: All bookmark data is handled locally on your device
- **Secure API integration**: Uses your personal Raindrop.io API token
- **Connection testing**: Verify your API token before syncing

### 📁 **Smart Organization**

- **Folder structure preservation**: Maintains your Raindrop.io collection organization in Chrome bookmarks
- **Clean imports**: Automatically replaces old "Raindrop" folder with fresh bookmarks
- **Metadata preservation**: Keeps bookmark titles, URLs, and folder hierarchy intact

## 🚀 Quick Start

1. **Install** the extension from the Chrome Web Store
2. **Get your API token:**
   - Visit [Raindrop.io Integrations](https://app.raindrop.io/settings/integrations)
   - Create a **new integration**
   - Copy the **test token**
3. **Configure** the extension:
   - Open the extension options page
   - Enter your API token
   - Test the connection
   - Configure auto-sync preferences (optional)
4. **Enjoy** automatic synchronization of your bookmarks!

## 💡 Perfect For

- ✅ Users who want their Raindrop.io bookmarks available in Chrome
- ✅ Anyone seeking automated bookmark backup solutions
- ✅ Teams sharing bookmark collections across browsers
- ✅ Power users managing large bookmark libraries

## 🛠️ Technical Details

- **Chrome Manifest V3** for modern browser compatibility
- **Service worker architecture** for efficient background processing
- **Netscape bookmark format parsing** for reliable data import
- **Comprehensive error handling** and user feedback
- **Persistent state management** across browser sessions

## 📋 Requirements

- Chrome browser with extensions support
- Valid [Raindrop.io](https://raindrop.io/) account
- API token from Raindrop.io integrations page

## 🔧 Configuration Options

### Auto-Sync Settings

- **Enable/disable** automatic synchronization
- **Frequency selection**: Hourly, daily, or weekly
- **Next backup time** display

### Manual Controls

- **Immediate sync** button for on-demand backups
- **Connection testing** to verify API token
- **Real-time status** updates during sync process

## 🚨 Important Notes

- The extension creates a "Raindrop" folder in your Chrome bookmarks
- Each sync replaces the existing folder with fresh data
- Backup process may take several minutes for large collections
- Internet connection required for API communication

## 🆘 Troubleshooting

### Common Issues

- **Token invalid**: Verify your API token in Raindrop.io settings
- **Sync timeout**: Large collections may take up to 30 minutes
- **Connection failed**: Check your internet connection and Raindrop.io status

### Getting Help

- Check the extension options page for status messages
- Review Chrome's extension error logs
- Ensure Raindrop.io service is accessible

---

**Transform your bookmark management experience with Raindrop Sync!**

_Made with ❤️ for the Raindrop.io community_
