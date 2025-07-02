// Classe principal para gerenciar a lista de tarefas
class TodoList {
    constructor() {
        this.tasks = this.loadTasks();
        this.currentFilter = 'all';
        this.editingTaskId = null;
        this.init();
    }

    // Inicializa a aplicação
    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
    }

    // Vincula eventos aos elementos da interface
    bindEvents() {
        // Formulário de adicionar tarefa
        document.getElementById('todo-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Botões de ação
        document.getElementById('clear-completed').addEventListener('click', () => {
            this.showConfirmModal('Deseja remover todas as tarefas concluídas?', () => {
                this.clearCompleted();
            });
        });

        document.getElementById('clear-all').addEventListener('click', () => {
            this.showConfirmModal('Deseja remover TODAS as tarefas?', () => {
                this.clearAll();
            });
        });

        // Modal de confirmação
        document.getElementById('confirm-yes').addEventListener('click', () => {
            this.hideConfirmModal();
            if (this.pendingAction) {
                this.pendingAction();
                this.pendingAction = null;
            }
        });

        document.getElementById('confirm-no').addEventListener('click', () => {
            this.hideConfirmModal();
            this.pendingAction = null;
        });

        // Fechar modal clicando fora
        document.getElementById('confirm-modal').addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') {
                this.hideConfirmModal();
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideConfirmModal();
                this.cancelEdit();
            }
        });
    }

    // Adiciona uma nova tarefa
    addTask() {
        const input = document.getElementById('todo-input');
        const text = input.value.trim();

        if (!text) return;

        if (this.editingTaskId) {
            this.updateTask(this.editingTaskId, text);
        } else {
            const task = {
                id: this.generateId(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString(),
                completedAt: null
            };

            this.tasks.unshift(task);
            this.saveTasks();
            this.render();
            this.updateStats();
            this.showNotification('Tarefa adicionada com sucesso!', 'success');
        }

        input.value = '';
        input.focus();
    }

    // Atualiza uma tarefa existente
    updateTask(id, newText) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.text = newText;
            this.saveTasks();
            this.render();
            this.showNotification('Tarefa atualizada com sucesso!', 'success');
        }
        this.cancelEdit();
    }

    // Cancela a edição
    cancelEdit() {
        this.editingTaskId = null;
        const input = document.getElementById('todo-input');
        const addBtn = document.querySelector('.add-btn');
        input.value = '';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
        addBtn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }

    // Inicia a edição de uma tarefa
    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            this.editingTaskId = id;
            const input = document.getElementById('todo-input');
            const addBtn = document.querySelector('.add-btn');
            
            input.value = task.text;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            
            addBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
            addBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        }
    }

    // Alterna o status de conclusão de uma tarefa
    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            this.saveTasks();
            this.render();
            this.updateStats();
            
            const message = task.completed ? 'Tarefa concluída!' : 'Tarefa reaberta!';
            this.showNotification(message, 'success');
        }
    }

    // Remove uma tarefa
    deleteTask(id) {
        this.showConfirmModal('Deseja realmente excluir esta tarefa?', () => {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.saveTasks();
            this.render();
            this.updateStats();
            this.showNotification('Tarefa removida com sucesso!', 'success');
        });
    }

    // Define o filtro ativo
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Atualiza botões de filtro
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.render();
    }

    // Filtra as tarefas baseado no filtro atual
    getFilteredTasks() {
        switch (this.currentFilter) {
            case 'pending':
                return this.tasks.filter(task => !task.completed);
            case 'completed':
                return this.tasks.filter(task => task.completed);
            default:
                return this.tasks;
        }
    }

    // Remove todas as tarefas concluídas
    clearCompleted() {
        const completedCount = this.tasks.filter(t => t.completed).length;
        this.tasks = this.tasks.filter(t => !t.completed);
        this.saveTasks();
        this.render();
        this.updateStats();
        this.showNotification(`${completedCount} tarefa(s) concluída(s) removida(s)!`, 'success');
    }

    // Remove todas as tarefas
    clearAll() {
        const totalCount = this.tasks.length;
        this.tasks = [];
        this.saveTasks();
        this.render();
        this.updateStats();
        this.showNotification(`${totalCount} tarefa(s) removida(s)!`, 'success');
    }

    // Renderiza a lista de tarefas
    render() {
        const todoList = document.getElementById('todo-list');
        const emptyState = document.getElementById('empty-state');
        const filteredTasks = this.getFilteredTasks();

        todoList.innerHTML = '';

        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `todo-item ${task.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <input 
                    type="checkbox" 
                    class="todo-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="todoApp.toggleTask('${task.id}')"
                >
                <span class="todo-text">${this.escapeHtml(task.text)}</span>
                <span class="todo-date">${this.formatDate(task.createdAt)}</span>
                <div class="todo-actions-item">
                    <button class="edit-btn" onclick="todoApp.editTask('${task.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="todoApp.deleteTask('${task.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            todoList.appendChild(li);
        });
    }

    // Atualiza as estatísticas
    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;

        document.getElementById('total-tasks').textContent = total;
        document.getElementById('pending-tasks').textContent = pending;
        document.getElementById('completed-tasks').textContent = completed;
    }

    // Mostra modal de confirmação
    showConfirmModal(message, action) {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').style.display = 'block';
        this.pendingAction = action;
    }

    // Esconde modal de confirmação
    hideConfirmModal() {
        document.getElementById('confirm-modal').style.display = 'none';
    }

    // Mostra notificação (implementação simples)
    showNotification(message, type = 'info') {
        // Remove notificação existente se houver
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Adiciona estilos inline para a notificação
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'success' ? '#28a745' : '#17a2b8',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '9999',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: '500',
            animation: 'slideInRight 0.3s ease'
        });

        document.body.appendChild(notification);

        // Remove após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Carrega tarefas do localStorage
    loadTasks() {
        try {
            const saved = localStorage.getItem('todoList');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Erro ao carregar tarefas:', error);
            return [];
        }
    }

    // Salva tarefas no localStorage
    saveTasks() {
        try {
            localStorage.setItem('todoList', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Erro ao salvar tarefas:', error);
            this.showNotification('Erro ao salvar dados!', 'error');
        }
    }

    // Gera um ID único para as tarefas
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Formata data para exibição
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Agora';
        if (minutes < 60) return `${minutes}m atrás`;
        if (hours < 24) return `${hours}h atrás`;
        if (days < 7) return `${days}d atrás`;
        
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Escapa HTML para prevenir XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Exporta dados (funcionalidade adicional)
    exportData() {
        const data = {
            tasks: this.tasks,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todolist-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Dados exportados com sucesso!', 'success');
    }

    // Importa dados (funcionalidade adicional)
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.tasks && Array.isArray(data.tasks)) {
                    this.showConfirmModal('Importar dados substituirá a lista atual. Continuar?', () => {
                        this.tasks = data.tasks;
                        this.saveTasks();
                        this.render();
                        this.updateStats();
                        this.showNotification('Dados importados com sucesso!', 'success');
                    });
                } else {
                    throw new Error('Formato de arquivo inválido');
                }
            } catch (error) {
                this.showNotification('Erro ao importar dados!', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Adiciona estilos CSS para as notificações
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        transition: all 0.3s ease;
    }
    
    .notification:hover {
        transform: translateX(-5px);
        cursor: pointer;
    }
`;
document.head.appendChild(notificationStyles);

// Inicializa a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoList();
    
    // Adiciona atalhos de teclado adicionais
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter para adicionar tarefa rapidamente
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const input = document.getElementById('todo-input');
            if (input.value.trim()) {
                todoApp.addTask();
            }
        }
        
        // Ctrl/Cmd + E para exportar dados
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            todoApp.exportData();
        }
    });
    
    // Adiciona funcionalidade de arrastar e soltar para importar
    const todoApp_element = document.querySelector('.todo-app');
    
    todoApp_element.addEventListener('dragover', (e) => {
        e.preventDefault();
        todoApp_element.style.borderColor = '#667eea';
        todoApp_element.style.backgroundColor = '#f8f9ff';
    });
    
    todoApp_element.addEventListener('dragleave', (e) => {
        e.preventDefault();
        todoApp_element.style.borderColor = '';
        todoApp_element.style.backgroundColor = '';
    });
    
    todoApp_element.addEventListener('drop', (e) => {
        e.preventDefault();
        todoApp_element.style.borderColor = '';
        todoApp_element.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/json') {
            todoApp.importData(files[0]);
        }
    });
});

// Registra Service Worker para funcionalidade offline (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(() => console.log('Service Worker não registrado'));
    });
}
