from pydantic_ai import (
    Agent,
    UsageLimits,
)
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIChatModelSettings
from pydantic_ai.providers.openrouter import OpenRouterProvider


class PerformanceAgent:
    def __init__(self, model_name: str, openrouter_api_key: str):
        self.model_settings = OpenAIChatModelSettings(max_tokens=50000)
        self.model = OpenAIChatModel(
            model_name=model_name,
            settings=self.model_settings,
            provider=OpenRouterProvider(api_key=openrouter_api_key),
        )

    async def run(self, user_prompt: str, syste_prompt: str) -> str:
        agent = Agent(
            model=self.model,
            system_prompt=syste_prompt,
            usage_limits=UsageLimits(max_tokens=50000),
        )
        response = await agent.run(user_prompt)
        return response.output
