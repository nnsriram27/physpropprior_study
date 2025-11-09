# Analyzing Study Results

After collecting data from participants, use this guide to analyze the results.

## Data Collection

Each participant will download a JSON file with their responses. The filename format is:
```
2afc-study-results-[timestamp].json
```

## Combining Multiple Participant Data

### Python Example

```python
import json
import pandas as pd
from pathlib import Path

# Load all result files from a directory
results_dir = Path("participant_results")
all_responses = []

for json_file in results_dir.glob("*.json"):
    with open(json_file, 'r') as f:
        data = json.load(f)
        participant_id = json_file.stem  # Use filename as participant ID
        
        for response in data['responses']:
            response['participant_id'] = participant_id
            response['study_start'] = data['studyInfo']['startTime']
            response['study_end'] = data['studyInfo']['endTime']
            all_responses.append(response)

# Create DataFrame
df = pd.DataFrame(all_responses)
print(df.head())

# Save combined data
df.to_csv('combined_results.csv', index=False)
```

## Basic Analysis

### Response Distribution

```python
# Count responses per trial
response_counts = df.groupby(['trialIndex', 'choice']).size().unstack(fill_value=0)
print(response_counts)

# Calculate percentages
response_percentages = response_counts.div(response_counts.sum(axis=1), axis=0) * 100
print(response_percentages)
```

### Response Time Analysis

```python
# Average response time per trial
avg_response_time = df.groupby('trialIndex')['responseTime'].mean() / 1000  # Convert to seconds
print(f"Average response times (seconds):\n{avg_response_time}")

# Response time statistics
print(f"\nOverall statistics:")
print(f"Mean: {df['responseTime'].mean() / 1000:.2f} seconds")
print(f"Median: {df['responseTime'].median() / 1000:.2f} seconds")
print(f"Std Dev: {df['responseTime'].std() / 1000:.2f} seconds")
```

### Preference Analysis

```python
# Overall preference (Video A vs Video B)
overall_preference = df['choice'].value_counts()
print(f"\nOverall preference:")
print(f"Video A: {overall_preference.get('A', 0)} ({overall_preference.get('A', 0)/len(df)*100:.1f}%)")
print(f"Video B: {overall_preference.get('B', 0)} ({overall_preference.get('B', 0)/len(df)*100:.1f}%)")
```

## Statistical Tests

### Chi-Square Test (Preference)

```python
from scipy.stats import chi2_contingency

# Test if preference differs by trial
contingency_table = pd.crosstab(df['trialIndex'], df['choice'])
chi2, p_value, dof, expected = chi2_contingency(contingency_table)

print(f"\nChi-square test:")
print(f"χ² = {chi2:.4f}")
print(f"p-value = {p_value:.4f}")
print(f"Significant difference: {'Yes' if p_value < 0.05 else 'No'}")
```

### Binomial Test (Overall Preference)

```python
from scipy.stats import binom_test

# Test if preference differs from 50-50 chance
n_total = len(df)
n_video_a = (df['choice'] == 'A').sum()

p_value = binom_test(n_video_a, n_total, 0.5, alternative='two-sided')
print(f"\nBinomial test (H0: 50-50 preference):")
print(f"p-value = {p_value:.4f}")
print(f"Significant preference: {'Yes' if p_value < 0.05 else 'No'}")
```

## Visualization

### Preference by Trial

```python
import matplotlib.pyplot as plt
import seaborn as sns

# Set style
sns.set_style("whitegrid")

# Plot preference distribution
fig, ax = plt.subplots(figsize=(10, 6))
response_percentages.plot(kind='bar', ax=ax)
plt.title('Response Distribution by Trial')
plt.xlabel('Trial Index')
plt.ylabel('Percentage (%)')
plt.legend(title='Choice', labels=['Video A', 'Video B'])
plt.xticks(rotation=0)
plt.tight_layout()
plt.savefig('preference_by_trial.png', dpi=300)
plt.show()
```

### Response Time Distribution

```python
# Response time histogram
fig, ax = plt.subplots(figsize=(10, 6))
plt.hist(df['responseTime'] / 1000, bins=20, edgecolor='black')
plt.title('Response Time Distribution')
plt.xlabel('Response Time (seconds)')
plt.ylabel('Frequency')
plt.tight_layout()
plt.savefig('response_time_distribution.png', dpi=300)
plt.show()
```

### Response Time by Trial

```python
# Box plot
fig, ax = plt.subplots(figsize=(10, 6))
df['responseTime_sec'] = df['responseTime'] / 1000
sns.boxplot(data=df, x='trialIndex', y='responseTime_sec', ax=ax)
plt.title('Response Time by Trial')
plt.xlabel('Trial Index')
plt.ylabel('Response Time (seconds)')
plt.tight_layout()
plt.savefig('response_time_by_trial.png', dpi=300)
plt.show()
```

## Inter-Rater Reliability (Optional)

If multiple participants rate the same videos:

```python
from statsmodels.stats.inter_rater import fleiss_kappa

# Prepare data: rows=items, columns=categories
# Count how many raters selected A or B for each trial
trial_counts = df.groupby('trialIndex')['choice'].value_counts().unstack(fill_value=0)
trial_counts = trial_counts[['A', 'B']]  # Ensure order

kappa = fleiss_kappa(trial_counts.values, method='fleiss')
print(f"\nFleiss' Kappa: {kappa:.4f}")
print(f"Agreement: ", end="")
if kappa < 0:
    print("Poor")
elif kappa < 0.20:
    print("Slight")
elif kappa < 0.40:
    print("Fair")
elif kappa < 0.60:
    print("Moderate")
elif kappa < 0.80:
    print("Substantial")
else:
    print("Almost Perfect")
```

## Report Template

### Summary Statistics Table

```python
# Create summary table
summary = pd.DataFrame({
    'Trial': range(len(df['trialIndex'].unique())),
    'Question': df.groupby('trialIndex')['question'].first(),
    'N': df.groupby('trialIndex').size(),
    'Video A (%)': (df.groupby('trialIndex')['choice'].apply(lambda x: (x == 'A').sum() / len(x) * 100)),
    'Video B (%)': (df.groupby('trialIndex')['choice'].apply(lambda x: (x == 'B').sum() / len(x) * 100)),
    'Mean RT (s)': df.groupby('trialIndex')['responseTime'].mean() / 1000
})

print(summary.to_string(index=False))
summary.to_csv('summary_statistics.csv', index=False)
```

## Export Results for Paper

```python
# LaTeX table
print(summary.to_latex(index=False, float_format="%.2f"))

# Markdown table
print(summary.to_markdown(index=False))
```

## Quality Control

### Check for Invalid Responses

```python
# Check for extremely fast responses (< 1 second - might be accidental clicks)
fast_responses = df[df['responseTime'] < 1000]
print(f"\nFast responses (< 1s): {len(fast_responses)}")

# Check for extremely slow responses (> 60 seconds - might be distracted)
slow_responses = df[df['responseTime'] > 60000]
print(f"Slow responses (> 60s): {len(slow_responses)}")

# Optionally filter
df_filtered = df[(df['responseTime'] >= 1000) & (df['responseTime'] <= 60000)]
print(f"\nFiltered dataset: {len(df_filtered)} / {len(df)} responses retained")
```

## Additional Analyses

### By Question Type

If you have different question types in your study:

```python
# Add question category (you'll need to define this based on your questions)
def categorize_question(q):
    if 'realistic' in q.lower():
        return 'Realism'
    elif 'motion' in q.lower():
        return 'Motion Quality'
    elif 'natural' in q.lower():
        return 'Naturalness'
    else:
        return 'Other'

df['question_category'] = df['question'].apply(categorize_question)
category_preference = df.groupby('question_category')['choice'].value_counts(normalize=True)
print(category_preference)
```

### Participant Consistency

Check if individual participants are consistent:

```python
# Calculate consistency score (how often they choose A vs B)
participant_consistency = df.groupby('participant_id')['choice'].apply(
    lambda x: max(x.value_counts(normalize=True))
)
print(f"\nAverage participant consistency: {participant_consistency.mean():.2%}")
```

## R Example (Alternative)

```r
library(tidyverse)
library(jsonlite)

# Load and combine data
files <- list.files("participant_results", pattern = "*.json", full.names = TRUE)

all_data <- map_df(files, function(file) {
  data <- fromJSON(file)
  responses <- data$responses %>%
    mutate(participant_id = basename(file))
  return(responses)
})

# Basic analysis
all_data %>%
  group_by(trialIndex, choice) %>%
  summarise(count = n(), .groups = 'drop') %>%
  pivot_wider(names_from = choice, values_from = count)

# Statistical test
chisq.test(table(all_data$trialIndex, all_data$choice))
```

## Notes

- Always check your data for quality issues before analysis
- Consider pre-registering your analysis plan
- Report all statistical tests performed (avoid p-hacking)
- Include effect sizes along with p-values
- Follow your field's reporting standards (e.g., APA for psychology)
