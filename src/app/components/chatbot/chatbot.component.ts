import { Component, signal, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini-service';
import { NotebookService, NotebookData, SheetData } from '../../services/notebook';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isTyping?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [FormsModule, CommonModule, MarkdownPipe],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements AfterViewInit {
  geminiService = inject(GeminiService);
  notebookService = inject(NotebookService);
  
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  
  messages = signal<ChatMessage[]>([
    {
      id: '1',
      text: '¡Hola! Soy tu asistente IA para notas y productividad.\n\nTe ayudo a:\n📝 **Organizar apuntes**\n✍️ **Redactar textos**\n💡 **Generar ideas**\n📊 **Analizar información**\n\n¿En qué te ayudo?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  
  inputMessage = signal('');
  isTyping = signal(false);
  isOpen = signal(false);
  
  private conversationHistory: string[] = [
  `# ERES MI ASISTENTE DE IA PARA NOTAS Y PRODUCTIVIDAD

## IDENTIDAD Y PROPÓSITO
Eres un asistente de IA experto para gestión de apuntes y productividad. Tu objetivo es ayudar de forma directa y concisa.

## REGLAS DE RESPUESTA
- Sé BREVE y DIRECTO (máximo 2-3 párrafos)
- Ve al punto principal inmediatamente
- Usa viñetas para listar información
- Evita explicaciones largas o introducciones innecesarias
- Sé práctico y accionable

## CAPACIDADES PRINCIPALES

### 📝 Gestión de Apuntes
- Organizar y estructurar información
- Crear resúmenes ejecutivos
- Extraer puntos clave
- Conectar ideas entre apuntes

### ✍️ Redacción y Edición
- Redactar textos profesionales
- Mejorar claridad y estilo
- Corregir gramática
- Crear borradores

### 💡 Productividad
- Generar ideas rápidas
- Crear listas de tareas
- Sugerir métodos de estudio
- Optimizar flujos de trabajo

### 📊 Análisis
- Sintetizar información
- Identificar patrones clave
- Generar insights breves

## FORMATO
- Usa **negritas** para destacar puntos importantes
- Usa viñetas (-) para listas
- Sé conversacional pero conciso
- Adapta el tono al contexto

Tu objetivo es dar respuestas útiles y directas que el usuario pueda aplicar inmediatamente.`
  ];

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  toggleChat() {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async sendMessage() {
    const message = this.inputMessage().trim();
    if (!message || this.isTyping()) return;

    // Agregar mensaje del usuario
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: message,
      sender: 'user',
      timestamp: new Date()
    };

    this.messages.set([...this.messages(), userMessage]);
    this.inputMessage.set('');
    this.isTyping.set(true);

    // Agregar mensaje de "escribiendo..."
    const typingMessage: ChatMessage = {
      id: 'typing',
      text: 'Escribiendo...',
      sender: 'bot',
      timestamp: new Date(),
      isTyping: true
    };
    
    this.messages.set([...this.messages(), typingMessage]);
    this.scrollToBottom();

    try {
      // Preparar el contexto para Gemini
      const context = this.buildContext();
      const prompt = `${context}\n\nUsuario: ${message}\n\nAsistente:`;
      
      const response = await this.geminiService.ask(prompt);
      
      // Remover mensaje de "escribiendo..."
      const messagesWithoutTyping = this.messages().filter(msg => msg.id !== 'typing');
      
      // Agregar respuesta del bot
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date()
      };
      
      this.messages.set([...messagesWithoutTyping, botMessage]);
      
      // Actualizar historial de conversación
      this.conversationHistory.push(`Usuario: ${message}`);
      this.conversationHistory.push(`Asistente: ${response}`);
      
      // Mantener solo los últimos 10 intercambios en el historial
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      
      // Remover mensaje de "escribiendo..."
      const messagesWithoutTyping = this.messages().filter(msg => msg.id !== 'typing');
      
      // Agregar mensaje de error
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?',
        sender: 'bot',
        timestamp: new Date()
      };
      
      this.messages.set([...messagesWithoutTyping, errorMessage]);
    } finally {
      this.isTyping.set(false);
      this.scrollToBottom();
    }
  }

  private buildContext(): string {
    const notebooks = this.notebookService.getNotebooks();
    let contextInfo = '\n\n## CONTEXTO ACTUAL DE TUS APUNTES:\n\n';
  
    if (notebooks.length === 0) {
      contextInfo += '- No tienes notebooks creados aún\n';
    } else {
      notebooks.forEach(nb => {
        contextInfo += `### 📓 ${nb.name}\n`;
        contextInfo += `- ${nb.sheets.length} hojas/apuntes\n`;
        
        // Mostrar últimas 5 hojas con contenido
        const recentSheets = nb.sheets
          .filter(sheet => sheet.content && sheet.content.trim().length > 0)
          .slice(-5);
        
        if (recentSheets.length > 0) {
          contextInfo += '- Apuntes recientes:\n';
          recentSheets.forEach(sheet => {
            const preview = sheet.content.replace(/<[^>]*>/g, '').substring(0, 100);
            contextInfo += `  • ${sheet.title}: "${preview}..."\n`;
            if (sheet.tags && sheet.tags.length > 0) {
              contextInfo += `    Etiquetas: ${sheet.tags.join(', ')}\n`;
            }
          });
        }
        contextInfo += '\n';
      });
    }
  
    return this.conversationHistory.join('\n') + contextInfo;
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  clearChat() {
    this.messages.set([{
      id: Date.now().toString(),
      text: '¡Hola! Soy tu asistente IA. ¿En qué puedo ayudarte con tus notas?',
      sender: 'bot',
      timestamp: new Date()
    }]);
    this.conversationHistory = [
      'Eres un asistente útil para una aplicación de notas. Ayuda a los usuarios a organizar sus ideas, mejorar su escritura y responder preguntas sobre sus notas. Sé conciso y amigable.'
    ];
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}
