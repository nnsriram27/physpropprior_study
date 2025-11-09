# PhysPropPrior 2AFC Video Study

User Study for PhysPropPrior Paper - A web-based Two-Alternative Forced Choice (2AFC) study interface for comparing videos.

## Overview

This repository hosts a 2AFC study interface where participants can:
- View two videos side by side (Video A and Video B)
- Answer questions by selecting which video best matches the criteria
- Complete multiple trials in sequence
- Download their responses as JSON data

## Quick Start

### 1. Add Your Videos

Place your video files in the `videos/` directory:
```
videos/
├── your_video_a1.mp4
├── your_video_b1.mp4
├── your_video_a2.mp4
└── your_video_b2.mp4
```

**Supported formats:** MP4 (recommended), WebM, OGG

### 2. Configure Your Study

Edit `config.js` to define your study trials:

```javascript
const studyTrials = [
    {
        question: "Which video shows more realistic physics behavior?",
        videoA: "videos/your_video_a1.mp4",
        videoB: "videos/your_video_b1.mp4"
    },
    {
        question: "Which video has better object motion?",
        videoA: "videos/your_video_a2.mp4",
        videoB: "videos/your_video_b2.mp4"
    }
    // Add more trials as needed
];
```

### 3. Test Locally

Open `index.html` in your web browser to test the study locally.

### 4. Deploy to GitHub Pages

1. Go to your repository Settings
2. Navigate to Pages section
3. Under "Source", select the branch (e.g., `main` or `copilot/add-2afc-video-study`)
4. Click Save
5. Your study will be available at: `https://[username].github.io/physpropprior_study/`

## File Structure

```
physpropprior_study/
├── index.html          # Main HTML structure
├── styles.css          # Styling and layout
├── study.js            # Study logic and interaction
├── config.js           # Study configuration (trials and questions)
├── videos/             # Directory for video files
│   └── README.md       # Guide for adding videos
└── README.md           # This file
```

## Features

- **Responsive Design**: Works on desktop and mobile devices
- **Video Controls**: Participants can play, pause, and replay videos as needed
- **Progress Tracking**: Visual progress bar shows completion status
- **Navigation**: Participants can review and change previous responses
- **Data Export**: Results are downloadable as JSON with timestamps and response times
- **Clean Interface**: Minimal, distraction-free design

## Data Collection

Study responses are stored locally in the browser during the session. At the end of the study, participants can download their responses as a JSON file containing:

- Study metadata (start time, end time, total trials)
- Individual trial responses (choice, response time, timestamps)
- Trial details (questions, video paths)

Example output:
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
    }
  ]
}
```

## Customization

### Styling
Edit `styles.css` to customize colors, fonts, and layout.

### Study Flow
Edit `study.js` to modify behavior such as:
- Auto-advance timing
- Response validation
- Additional data collection

### Welcome/Completion Messages
Edit `index.html` to customize the welcome and completion screens.

## Video File Considerations

- **File Size**: GitHub has a 100MB file size limit per file
- **Compression**: Consider compressing videos to reduce loading times
- **Git LFS**: For very large files, consider using Git Large File Storage
- **External Hosting**: Alternatively, host large videos elsewhere and link to them

## Browser Compatibility

This study works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Privacy & Ethics

- No data is automatically collected or sent to any server
- Participants must manually download their responses
- Consider adding consent forms if conducting formal research
- Follow your institution's IRB guidelines for human subjects research

## Contributing

Feel free to modify and extend this study interface for your research needs.

## License

This project is provided as-is for academic research purposes.

## Support

For issues or questions, please open an issue on GitHub.
