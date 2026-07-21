import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'sk-build-time-placeholder',
})

export const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6'
