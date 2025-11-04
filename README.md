# Monitoring Agent

Generate **weekly GitLab user performance reports** with metrics, charts, and AI-assisted evaluations.
The system collects developer activity from your GitLab instance, processes it through analytical and AI agents, and produces a **PDF report** summarizing quantitative KPIs and qualitative performance insights.

---

## 📊 Report Includes

### Numbers

-   **Commits Total**
-   **MRs Contributed To**
-   **Commit Line Changes Total**
-   **Merge Request Line Changes Total**
-   **Merge Request Approve Count**
-   **Comments Count**

### Charts

-   **Commits per Day** — Bar chart
-   **Commit Lines Added/Deleted Over Time** — Diverging bar chart

### Table

| MR Title | Connected Issues (id + URL) | Commits | Commit Line Changes | MR Line Changes | Approved | Merged At |

---

## 🧠 AI Agents

Outputs from these agents are embedded in the **MR Evaluation** and **Aggregated Insights** sections of each report.

### 1. **Commit Message Summarizer** (small model)

Summarizes raw commit messages for each MR to create a concise, readable context.

**Input:** Raw commit messages
**Output:** Short summary per MR

---

### 2. **MR Performance Evaluator** (large model)

Evaluates each merge request to provide qualitative insights into its complexity, quality, and effort.

**Context includes:**

-   MR title and description
-   MR state (open or closed)
-   Commit messages (summarized if lengthy)
-   Related issue titles and descriptions (trimmed if needed)
-   MR diff (optional, configurable)

**Returns:**

-   `description`: qualitative summary of MR purpose and scope
-   `quality_of_code`: textual assessment (e.g., “clean and maintainable”)
-   `estimated_time_need`: approximate implementation time in hours

---

### 3. **Performance Aggregator** (large model)

Aggregates all MR evaluations into an overall performance summary for the reporting period.

**Outputs:**

-   Developer performance overview
-   Overall code quality trend
-   Total estimated development time

---

## ⚙️ Architecture

| Component            | Role                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| **Data Collector**   | Fetches commits, MRs, issues, approvals, and comments from GitLab API |
| **Data Aggregator**  | Calculates metrics and weekly KPIs                                    |
| **Visualizer**       | Generates charts and tables using matplotlib or Plotly                |
| **Report Generator** | Builds the final PDF layout                                           |
| **AI Agents**        | Add MR-level and user-level qualitative analysis                      |
