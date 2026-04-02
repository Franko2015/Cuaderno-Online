# My-Notion 📝

Una aplicación web de notas moderna con IA integrada, inspirada en Notion pero con características únicas.

## ✨ Características

- 🧠 **Chatbot IA** con Google Gemini API
- 📓 **Gestión de cuadernos** y hojas organizadas
- ✍️ **Editor avanzado** con texto, dibujo y vista markdown
- 📎 **Gestión de archivos** con barra compacta
- 🎨 **Tema claro/oscuro** responsive
- � **Diseño responsive** para móviles
- � **Deploy en GitHub Pages** con seguridad

## 🚀 **Demo en Vivo**

🌐 **[https://franko2015.github.io/Cuaderno-Online](https://franko2015.github.io/Cuaderno-Online)**

## 📦 **Instalación Local**

### Prerrequisitos
- Node.js 20+
- npm o yarn
- Google Gemini API Key

### Pasos
```bash
# Clonar repositorio
git clone https://github.com/Franko2015/Cuaderno-Online.git
cd Cuaderno-Online

# Instalar dependencias
npm install

# Configurar API Key (crear archivo .env)
echo 'GEMINI_API_KEY="TU_API_KEY_AQUI"' > .env

# Iniciar desarrollo
npm start
```

## 🎯 **Scripts Disponibles**

```bash
# Desarrollo
npm start              # Servidor de desarrollo (http://localhost:4200)
npm run prod           # Servidor con config de producción

# Build
npm run build          # Build estándar
npm run build:github   # Build para GitHub Pages con base-href

# Testing
npm test               # Ejecutar tests
```

## 🚀 **Deploy en GitHub Pages**

### Automático con GitHub Actions
1. **Configura el Secret:**
   - Ve a Settings → Secrets and variables → Actions
   - Añade `GEMINI_API_KEY` con tu API key

2. **Activa GitHub Pages:**
   - Settings → Pages → Source: "GitHub Actions"

3. **Deploy Automático:**
   - Cada push a `main` hace deploy automático
   - URL: https://franko2015.github.io/Cuaderno-Online

### Manual
```bash
# Build para GitHub Pages
npm run build:github

# Subir a GitHub Pages manualmente
npx gh-pages --dist dist/My-Notion/browser
```

## 🔧 **Configuración de Entornos**

### Development (`src/environments/environment.ts`)
```typescript
export const environment = {
  production: false,
  geminiApiKey: "TU_API_KEY_AQUI"
};
```

### Production (`src/environments/environment.prod.ts`)
```typescript
export const environment = {
  production: true,
  geminiApiKey: process.env['GEMINI_API_KEY'] || 'fallback_key'
};
```

## 🛠️ **Stack Tecnológico**

- **Angular 21** con Signals y standalone components
- **TypeScript** para tipado seguro
- **TailwindCSS** para estilos modernos
- **Google Gemini API** para IA
- **GitHub Pages** para hosting y deploy
- **GitHub Actions** para CI/CD

## 🔐 **Seguridad**

- API Keys en GitHub Secrets
- Environment files excluidos de Git
- Build estático optimizado para producción
- Variables de entorno seguras

## 📱 **Características Técnicas**

### Markdown Rendering
- **Negritas**: `**texto**`
- **Cursivas**: `*texto*`
- **Listas**: `* item` o `1. item`
- **Encabezados**: `# Título`

### Modos de Interacción
- **Texto**: Editor WYSIWYG con formato
- **Dibujo**: Canvas con herramientas (pantalla completa)
- **Vista**: Renderizado con Markdown

### Responsive Design
- **Mobile-first**: Navegación inferior táctil
- **Touch controls**: Targets de 44px mínimo
- **Fullscreen drawing**: Panel lateral con herramientas
- **Optimized modals**: Adaptados para móviles

### Almacenamiento
- LocalStorage para persistencia
- Máximo 5MB por defecto
- Gestión automática de espacio

## 🤝 **Contribuir**

1. Fork el repositorio
2. Crear branch (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Abrir Pull Request

## 👨‍💻 **Autor**

**Franko2015** - [GitHub](https://github.com/Franko2015)

---

### 🌟 **Deploy Status**
- ✅ **Producción**: [franko2015.github.io/Cuaderno-Online](https://franko2015.github.io/Cuaderno-Online)
- ✅ **GitHub Actions** para deploy automático
- ✅ **API Key Segura** en GitHub Secrets
- ✅ **Build Optimizado** para GitHub Pages
- ✅ **Responsive Design** para móviles
