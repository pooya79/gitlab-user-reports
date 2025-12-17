from typing import List, Literal
from pydantic import BaseModel, Field


class WorkCategory(BaseModel):
    category_name: str = Field(
        ..., description="E.g., Refactoring, New Features, Maintenance"
    )
    percentage: int = Field(
        ..., description="Estimated percentage of total effort (0-100)"
    )


class Achievement(BaseModel):
    title: str = Field(..., description="Short headline of the achievement")
    impact: str = Field(
        ..., description="Specific business or technical value provided"
    )


class WeeklyPerformanceReport(BaseModel):
    # KPIs
    primary_focus: str = Field(
        ..., description="The main theme of the week (e.g., 'Infrastructure Stability')"
    )
    impact_score: Literal["High", "Medium", "Low"] = Field(
        ..., description="Overall business impact of the work"
    )
    efficiency_rating: Literal["High", "Medium", "Low"] = Field(
        ..., description="Ratio of output to time spent"
    )

    # AI Estimations (The requested addition)
    ai_estimated_hours: float = Field(
        ...,
        description="AI's estimation of hours required to complete these tasks based on complexity",
    )
    estimation_confidence: float = Field(
        ...,
        description="Confidence score (0.0 to 1.0) of the hour estimation based on log detail",
    )

    # Composition & Details
    work_composition: List[WorkCategory] = Field(
        ..., description="Breakdown of work distribution"
    )
    key_achievements: List[Achievement] = Field(
        ..., description="Top 2-3 specific accomplishments"
    )

    # Narrative
    executive_summary: str = Field(..., description="A 1-sentence high-level summary")
    complexity_note: str = Field(
        ..., description="A specific observation about the hardest task performed"
    )

    def to_markdown(self) -> str:
        """Helper to render the dashboard format from the raw data"""

        # Helper to draw progress bars
        def draw_bar(percent):
            filled = int(percent / 10)
            return f"{'█' * filled}{'░' * (10 - filled)}"

        # Build the composition section
        comp_str = ""
        for item in self.work_composition:
            comp_str += f"* `{draw_bar(item.percentage)}` **{item.percentage}%** {item.category_name}\n"

        # Build achievements
        ach_str = ""
        for i, item in enumerate(self.key_achievements, 1):
            ach_str += f"{i}. **{item.title}:** {item.impact}\n"

        return f"""
**WEEKLY PERFORMANCE CARD**

**📊 Executive KPIs**
| Metric | Value | Context |
| :--- | :--- | :--- |
| **Primary Focus** | {self.primary_focus} | {self.executive_summary} |
| **Impact Score** | {self.impact_score} | Efficiency: {self.efficiency_rating} |
| **AI Work Est.** | ⏱️ {self.ai_estimated_hours} Hours | Confidence: {int(self.estimation_confidence * 100)}% |

**🍰 Work Composition**
{comp_str}
**🏆 Key Achievements**
{ach_str}
**💡 Complexity Analysis**
> {self.complexity_note}
"""
