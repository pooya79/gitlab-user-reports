from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIChatModelSettings
from pydantic_ai.providers.openrouter import OpenRouterProvider
from .schema import WeeklyPerformanceReport


class PerformanceAgent:
    def __init__(self, model_name: str, openrouter_api_key: str):
        self.model_settings = OpenAIChatModelSettings(max_tokens=50000, temperature=0.2, openai_reasoning_effort="medium")
        self.model = OpenAIChatModel(
            model_name=model_name,
            settings=self.model_settings,
            provider=OpenRouterProvider(api_key=openrouter_api_key),
        )

    async def summarize_performance(self, user_stats: str, system_prompt: str) -> str:
        agent = Agent(
            model=self.model,
            system_prompt=system_prompt,
            output_type=WeeklyPerformanceReport,
        )
        response = await agent.run(
            user_stats,
        )
        return response.output.to_markdown()
