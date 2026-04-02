import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GeminiService {

  private genAI = new GoogleGenerativeAI(environment.geminiApiKey || '');

  async ask(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview'
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;

      return response.text();

    } catch (error) {
      console.error(error);
      return 'Error generando respuesta';
    }
  }
}