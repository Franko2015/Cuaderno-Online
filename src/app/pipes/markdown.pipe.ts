import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string): string {
    if (!text) return '';
    
    // Procesar negritas **texto**
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Procesar cursivas *texto*
    processedText = processedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Procesar encabezados
    processedText = processedText.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    processedText = processedText.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    processedText = processedText.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Procesar líneas
    processedText = processedText.replace(/^\- (.*$)/gm, '<li>$1</li>');
    processedText = processedText.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Procesar saltos de línea
    processedText = processedText.replace(/\n\n/g, '</p><p>');
    processedText = '<p>' + processedText + '</p>';
    
    // Limpiar etiquetas vacías
    processedText = processedText.replace(/<p><\/p>/g, '');
    processedText = processedText.replace(/<p>(<h[1-6]>)/g, '$1');
    processedText = processedText.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    processedText = processedText.replace(/<p>(<ul>)/g, '$1');
    processedText = processedText.replace(/(<\/ul>)<\/p>/g, '$1');
    
    // Sanitizar el HTML
    return this.sanitizer.sanitize(SecurityContext.HTML, processedText) || '';
  }
}
