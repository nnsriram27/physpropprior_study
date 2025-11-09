# Quick Setup Guide for 2AFC Video Study

This guide will help you set up your 2AFC video study in just a few steps.

## Step 1: Add Your Videos

1. Place your video files in the `videos/` directory
2. Recommended format: MP4 (best browser compatibility)
3. Name your files clearly (e.g., `condition1_a.mp4`, `condition1_b.mp4`)

## Step 2: Configure Your Study

Edit `config.js` to set up your trials:

```javascript
const studyTrials = [
    {
        question: "Your question here?",
        videoA: "videos/your_video_a1.mp4",
        videoB: "videos/your_video_b1.mp4"
    },
    {
        question: "Your second question?",
        videoA: "videos/your_video_a2.mp4",
        videoB: "videos/your_video_b2.mp4"
    }
    // Add as many trials as you need
];
```

## Step 3: Test Locally

1. Open `index.html` in your web browser
2. Go through the entire study to verify everything works
3. Test the "Download Results" button to ensure data export works

## Step 4: Deploy to GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" in the top menu
3. Scroll down and click "Pages" in the left sidebar
4. Under "Source", select your branch (e.g., `main` or `copilot/add-2afc-video-study`)
5. Click "Save"
6. Wait a few minutes for GitHub to build your site
7. Your study will be available at: `https://[username].github.io/physpropprior_study/`

## Step 5: Share with Participants

Once deployed, share the GitHub Pages URL with your study participants.

## Tips

### Video File Size
- GitHub has a 100MB file size limit per file
- Compress videos if needed to stay under this limit
- Consider using video compression tools like FFmpeg or HandBrake

### Git Large File Storage (Optional)
If you have very large video files:
1. Install Git LFS: `git lfs install`
2. Track video files: `git lfs track "*.mp4"`
3. Commit and push as normal

### Testing with Real Videos
Replace the sample video paths in `config.js` with your actual video files before sharing with participants.

### Data Collection
- Data is only stored in the participant's browser during the study
- No automatic data upload happens (privacy-preserving design)
- Participants must click "Download Results" to save their data
- Collect the JSON files from all participants for your analysis

## Common Issues

**Issue: Videos not loading**
- Check that video paths in `config.js` match the actual file locations
- Verify video format is MP4 (best compatibility)
- Check browser console for error messages

**Issue: GitHub Pages not showing changes**
- Wait 5-10 minutes after pushing changes
- Clear your browser cache
- Try opening in an incognito/private window

**Issue: Video files too large for GitHub**
- Compress videos using video editing software
- Use Git LFS for files over 100MB
- Consider hosting videos on external service and linking to them

## Need Help?

Check the main [README.md](README.md) for more detailed documentation, or open an issue on GitHub.
