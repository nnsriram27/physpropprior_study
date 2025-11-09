# Testing the 2AFC Study Interface

This guide helps you test the study interface before adding your real videos.

## Testing Without Videos

The interface will work even without video files - you'll see black video placeholders with controls. This allows you to:
- Test the overall flow
- Verify button functionality
- Check response collection
- Test data export

## Testing Locally

### Method 1: Direct File Open
Simply open `index.html` in your browser by double-clicking it.

### Method 2: Local Web Server (Recommended)
Using a local web server prevents CORS issues:

**Using Python:**
```bash
# Python 3
python3 -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

**Using Node.js:**
```bash
npx http-server -p 8080
```

**Using PHP:**
```bash
php -S localhost:8080
```

Then open: http://localhost:8080/index.html

## Creating Test Videos

If you want to test with actual videos before your real study videos are ready, you can create simple test videos:

### Option 1: Use Existing Videos
Download any short MP4 videos and place them in the `videos/` directory.

### Option 2: Generate Test Videos with FFmpeg
If you have FFmpeg installed:

```bash
# Create a 5-second test video with colored background
ffmpeg -f lavfi -i color=c=red:s=640x480:d=5 -vf "drawtext=text='Video A':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" videos/test_a.mp4

ffmpeg -f lavfi -i color=c=blue:s=640x480:d=5 -vf "drawtext=text='Video B':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" videos/test_b.mp4
```

### Option 3: Record Screen/Webcam
Use screen recording or webcam recording to create simple test videos.

## What to Test

### ✅ Functionality Checklist
- [ ] Welcome screen displays correctly
- [ ] "Start Study" button works
- [ ] Both videos display (with controls visible)
- [ ] Question text appears for each trial
- [ ] "Select Video A" button works and highlights
- [ ] "Select Video B" button works and highlights
- [ ] Auto-advance to next trial after selection
- [ ] Progress bar updates correctly
- [ ] "Previous" button works (after first trial)
- [ ] "Next" button enables after selection
- [ ] Final trial shows completion screen
- [ ] "Download Results" button downloads JSON file
- [ ] "Start Over" button restarts study

### ✅ Data Export Checklist
After completing the study and downloading results:
- [ ] JSON file downloads successfully
- [ ] File contains study metadata
- [ ] File contains all responses
- [ ] Each response has trial info, choice, and timestamp
- [ ] Response times are recorded

### ✅ Mobile Testing
Test on mobile devices or use browser dev tools:
- [ ] Layout is responsive
- [ ] Videos stack vertically on small screens
- [ ] Buttons are touch-friendly
- [ ] Text is readable

## Sample Test Scenario

1. Click "Start Study"
2. For trial 1: Select Video A
3. For trial 2: Select Video B
4. Click "Previous" to go back to trial 1
5. Verify selection is remembered
6. Click "Next" to return to trial 2
7. Click "Next" to go to trial 3
8. For trial 3: Select Video A
9. Click "Download Results"
10. Open the downloaded JSON file and verify data

## Expected JSON Output

```json
{
  "studyInfo": {
    "startTime": "2025-11-09T00:00:00.000Z",
    "endTime": "2025-11-09T00:05:00.000Z",
    "totalTrials": 3
  },
  "responses": [
    {
      "trialIndex": 0,
      "question": "Which video shows more realistic physics behavior?",
      "videoA": "videos/sample_a1.mp4",
      "videoB": "videos/sample_b1.mp4",
      "choice": "A",
      "responseTime": 5234,
      "timestamp": "2025-11-09T00:01:30.000Z"
    },
    {
      "trialIndex": 1,
      "question": "Which video has better object motion?",
      "videoA": "videos/sample_a2.mp4",
      "videoB": "videos/sample_b2.mp4",
      "choice": "B",
      "responseTime": 3456,
      "timestamp": "2025-11-09T00:02:45.000Z"
    },
    {
      "trialIndex": 2,
      "question": "Which video looks more natural?",
      "videoA": "videos/sample_a3.mp4",
      "videoB": "videos/sample_b3.mp4",
      "choice": "A",
      "responseTime": 4567,
      "timestamp": "2025-11-09T00:04:30.000Z"
    }
  ]
}
```

## Browser Console

Open browser dev tools (F12) to check for errors:
- **Expected**: 404 errors for missing video files (if testing without videos)
- **Unexpected**: JavaScript errors (if you see these, please report an issue)

## Ready for Production?

Once testing is complete:
1. ✅ Replace sample video paths in `config.js` with your real videos
2. ✅ Customize questions in `config.js`
3. ✅ Test with real videos locally
4. ✅ Deploy to GitHub Pages
5. ✅ Share with participants

## Troubleshooting

**Videos show but won't play:**
- Check video codec (H.264 MP4 is most compatible)
- Try converting videos to web-compatible format

**Interface looks different on mobile:**
- This is normal - the design is responsive
- Test on actual mobile device or use browser dev tools mobile emulation

**Download button doesn't work:**
- Check browser console for errors
- Verify browser allows downloads
- Try in a different browser

**Selections not saving:**
- Check browser console for JavaScript errors
- Ensure `study.js` is loaded properly
