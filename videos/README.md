# Videos Directory

This directory contains the video files used in the 2AFC study.

## Adding Videos

1. Place your video files in this directory
2. Update the `config.js` file in the root directory to reference your videos
3. Supported formats: MP4, WebM, OGG (MP4 recommended for best compatibility)

## Video Naming Convention

We recommend using a clear naming convention for your videos:
- `condition_trial_version.mp4` (e.g., `baseline_01_a.mp4`, `baseline_01_b.mp4`)
- Or any naming scheme that helps you organize your study materials

## File Size Considerations

- Keep video files reasonably sized for web delivery
- GitHub has a 100MB file size limit
- Consider compressing videos if they're too large
- For very large video files, consider using Git LFS (Large File Storage)

## Example Structure

```
videos/
├── sample_a1.mp4
├── sample_b1.mp4
├── sample_a2.mp4
├── sample_b2.mp4
├── sample_a3.mp4
└── sample_b3.mp4
```

## Note

The sample video files referenced in `config.js` should be replaced with your actual study videos.
