https://script.google.com/macros/s/AKfycbzwE6dMVePzfsGO9NkWyOJ51pcCZjAdSPu2bPTgNI_N-Blkl9uO0hvwv5f-NKqrXA6VCw/exec


python src/sample_question_packs.py \
  --count 5 --prefix friend \
  --seed 7

python src/compute_metrics.py --responses responses/ --output metrics.json

...?questionSet=packs/friend_01&submissionMode=local&responseEndpoint=https://script.google.com/macros/s/AKfycbzwE6dMVePzfsGO9NkWyOJ51pcCZjAdSPu2bPTgNI_N-Blkl9uO0hvwv5f-NKqrXA6VCw/exec
