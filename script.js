        // Configuração do Supabase
        const supabaseUrl = 'https://dylziaqkyavkfwjepqkp.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bHppYXFreWF2a2Z3amVwcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NTc1OTgsImV4cCI6MjA2ODAzMzU5OH0.gy5jXxKOTgeCf0Rwq7ktLTz1pyoZ8dJjZOK9UB9rHCM';

        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

        // Elementos DOM
        const btnNovaReceita = document.getElementById('btn-nova-receita');
        const closeForm = document.getElementById('close-form');
        const formContainer = document.getElementById('form-container');
        const receitaForm = document.getElementById('receita-form');
        const tabelaContainer = document.getElementById('tabela-container');
        const totalSalarioEl = document.getElementById('total-salario');
        const totalDescontosEl = document.getElementById('total-descontos');
        const totalLiquidoEl = document.getElementById('total-liquido');
        const notificationEl = document.getElementById('notification');
        const chartBtns = document.querySelectorAll('.chart-btn');
        const userInfo = document.getElementById('user-info');
        const userAvatar = document.getElementById('user-avatar');
        const userWelcome = document.getElementById('user-welcome');
        const avatarInput = document.getElementById('avatar-input');

        let receitas = [];
        let chartInstance = null;
        let currentChartType = 'bar';
        let ultimaReceitaId = null;

        // Formatar moeda BRL
        function formatarMoeda(valor) {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(valor);
        }

        // Mostrar notificação
        function showNotification(message, type = 'success') {
            notificationEl.textContent = message;
            notificationEl.className = `notification ${type} show`;

            setTimeout(() => {
                notificationEl.className = 'notification';
            }, 3000);
        }

        // Toggle formulário
        btnNovaReceita.addEventListener('click', () => {
            formContainer.classList.toggle('show');
        });

        closeForm.addEventListener('click', () => {
            formContainer.classList.remove('show');
        });

        // Carregar dados do usuário da última receita
        async function carregarUsuario() {
            try {
                const { data, error } = await supabase
                    .from('receitas')
                    .select('id, descricao, avatar_url')
                    .order('id', { ascending: false })
                    .limit(1)
                    .single();

                if (error) {
                    console.warn('Erro ao buscar avatar em receitas:', error.message);
                    usarUsuarioPadrao();
                    return;
                }

                if (data) {
                    ultimaReceitaId = data.id;
                    const nome = data.descricao || "Usuário";
                    userAvatar.src = data.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nome) + '&background=009ee3&color=fff&rounded=true';
                    userAvatar.alt = `Avatar de ${nome}`;
                    userWelcome.textContent = `Seja bem-vindo, ${nome}`;
                }
            } catch (error) {
                console.error('Erro ao carregar avatar:', error);
                usarUsuarioPadrao();
            }
        }

        function usarUsuarioPadrao() {
            const nome = "Usuário";
            userAvatar.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(nome) + '&background=009ee3&color=fff&rounded=true';
            userAvatar.alt = `Avatar de ${nome}`;
            userWelcome.textContent = `Seja bem-vindo, ${nome}`;
        }

        // Função para upload da imagem no Supabase Storage e salvar URL no banco
        async function uploadAvatar(file, receitaId) {
            if (!file || !receitaId) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `avatar_${receitaId}.${fileExt}`;
            const filePath = `${fileName}`;

            try {
                // Upload no bucket 'avatars' (crie este bucket no Supabase Storage)
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) throw uploadError;

                // Obter URL público
                const { data: publicUrlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                const avatarUrl = publicUrlData.publicUrl;

                // Atualizar avatar_url na receita
                const { error: updateError } = await supabase
                    .from('receitas')
                    .update({ avatar_url: avatarUrl })
                    .eq('id', receitaId);

                if (updateError) throw updateError;

                // Atualizar avatar na tela
                userAvatar.src = avatarUrl;
                showNotification('Avatar atualizado com sucesso!');
            } catch (error) {
                console.error('Erro ao fazer upload do avatar:', error);
                showNotification('Erro ao atualizar avatar', 'error');
            }
        }

        // Evento: clicar no avatar abre seletor de arquivo
        userAvatar.addEventListener('click', () => {
            avatarInput.click();
        });

        // Evento: arquivo selecionado
        avatarInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // Validar tipo e tamanho do arquivo
            if (!file.type.startsWith('image/')) {
                showNotification('Por favor, selecione uma imagem válida.', 'error');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                showNotification('Imagem muito grande. Máximo 2MB.', 'error');
                return;
            }

            if (!ultimaReceitaId) {
                showNotification('Não foi possível identificar a receita para atualizar.', 'error');
                return;
            }

            await uploadAvatar(file, ultimaReceitaId);

            // Limpar input para permitir re-upload do mesmo arquivo se quiser
            avatarInput.value = '';
        });

        // Inicializar aplicação
        document.addEventListener('DOMContentLoaded', initApp);

        async function initApp() {
            // Configurar event listeners
            receitaForm.addEventListener('submit', handleSubmit);
            chartBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    chartBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    currentChartType = e.target.dataset.chartType;
                    montarGrafico();
                });
            });

            // Carregar dados do usuário
            await carregarUsuario();

            // Carregar receitas do Supabase
            await loadReceitas();

            // Definir mês atual como padrão
            const hoje = new Date();
            const mesAtual = hoje.toISOString().slice(0, 7);
            document.getElementById('mes').value = mesAtual;
        }

        async function loadReceitas() {
            try {
                tabelaContainer.innerHTML = `
                    <div class="loading">
                        <div class="loading-spinner"></div>
                    </div>
                `;

                const { data, error } = await supabase
                    .from('receitas')
                    .select('*')
                    .order('mes', { ascending: false });

                if (error) throw error;

                receitas = data || [];
                renderTabela();
                calcularTotais();
                montarGrafico();
            } catch (error) {
                console.error('Erro ao carregar receitas:', error);
                showNotification('Erro ao carregar dados', 'error');
                renderTabela();
            }
        }

        function renderTabela() {
            if (receitas.length === 0) {
                tabelaContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <p class="empty-state-text">Nenhuma receita cadastrada</p>
                        <button class="nav-button" onclick="document.getElementById('btn-nova-receita').click()">
                            Adicionar Primeira Receita
                        </button>
                    </div>
                `;
                return;
            }

            let tableHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Mês/Ano</th>
                            <th class="text-right">Salário Bruto</th>
                            <th class="text-right">Descontos</th>
                            <th class="text-right">Salário Líquido</th>
                            <th>Descrição</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            receitas.forEach(receita => {
                const data = new Date(receita.mes);
                const mes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                const salarioLiquido = receita.salario - receita.descontos;

                tableHTML += `
                    <tr>
                        <td>${mes.charAt(0).toUpperCase() + mes.slice(1)}</td>
                        <td class="text-right currency">${formatarMoeda(receita.salario)}</td>
                        <td class="text-right currency text-danger">${formatarMoeda(receita.descontos)}</td>
                        <td class="text-right currency text-success">${formatarMoeda(salarioLiquido)}</td>
                        <td>${receita.descricao || '-'}</td>
                        <td>
                            <button class="action-btn delete-btn" onclick="deleteReceita(${receita.id})">
                                Excluir
                            </button>
                        </td>
                    </tr>
                `;
            });

            tableHTML += '</tbody></table>';
            tabelaContainer.innerHTML = tableHTML;
        }

        function calcularTotais() {
            const totalSalario = receitas.reduce((sum, receita) => sum + receita.salario, 0);
            const totalDescontos = receitas.reduce((sum, receita) => sum + receita.descontos, 0);
            const totalLiquido = totalSalario - totalDescontos;

            totalSalarioEl.textContent = formatarMoeda(totalSalario);
            totalDescontosEl.textContent = formatarMoeda(totalDescontos);
            totalLiquidoEl.textContent = formatarMoeda(totalLiquido);
        }

        function montarGrafico() {
            const ctx = document.getElementById('graficoSalario').getContext('2d');

            if (receitas.length === 0) {
                if (chartInstance) chartInstance.destroy();
                return;
            }

            const receitasOrdenadas = [...receitas].sort((a, b) => new Date(a.mes) - new Date(b.mes));
            const labels = receitasOrdenadas.map(r => {
                const d = new Date(r.mes);
                return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            });

            const dataSalarioBruto = receitasOrdenadas.map(r => r.salario);
            const dataDescontos = receitasOrdenadas.map(r => r.descontos);
            const dataSalarioLiquido = receitasOrdenadas.map(r => r.salario - r.descontos);

            if (chartInstance) chartInstance.destroy();

            let datasets = [];

            if (currentChartType === 'pie') {
                datasets = [{
                    label: 'Salário Líquido',
                    data: dataSalarioLiquido,
                    backgroundColor: [
                        '#009ee3', '#00a650', '#ff6b00', '#ff3b30', '#ff9500',
                        '#34c759', '#0077b6', '#00a650', '#ff5252', '#2ecc71'
                    ]
                }];
            } else {
                datasets = [
                    {
                        label: 'Salário Bruto',
                        data: dataSalarioBruto,
                        backgroundColor: 'rgba(0, 158, 227, 0.7)',
                        borderColor: '#009ee3',
                        borderWidth: 2
                    },
                    {
                        label: 'Descontos',
                        data: dataDescontos,
                        backgroundColor: 'rgba(255, 59, 48, 0.7)',
                        borderColor: '#ff3b30',
                        borderWidth: 2
                    },
                    {
                        label: 'Salário Líquido',
                        data: dataSalarioLiquido,
                        backgroundColor: 'rgba(52, 199, 89, 0.7)',
                        borderColor: '#34c759',
                        borderWidth: 2
                    }
                ];
            }

            chartInstance = new Chart(ctx, {
                type: currentChartType,
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: (context) => `R$ ${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            }
                        }
                    },
                    scales: currentChartType !== 'pie' ? {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            }
                        }
                    } : {}
                }
            });
        }

        async function handleSubmit(e) {
            e.preventDefault();

            const mesInput = document.getElementById('mes').value;
            const salario = parseFloat(document.getElementById('salario').value);
            const descontos = parseFloat(document.getElementById('descontos').value);
            const descricao = document.getElementById('descricao').value;

            if (!mesInput || isNaN(salario) || isNaN(descontos) || descontos > salario) {
                showNotification('Verifique os dados informados', 'error');
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('receitas')
                    .insert([{
                        mes: `${mesInput}-01`,
                        salario,
                        descontos,
                        descricao
                    }])
                    .select();

                if (error) throw error;

                receitas.unshift(data[0]);
                renderTabela();
                calcularTotais();
                montarGrafico();
                receitaForm.reset();
                document.getElementById('mes').value = mesInput;

                // Atualizar avatar após adicionar nova receita
                await carregarUsuario();

                showNotification('Receita adicionada com sucesso!');
                formContainer.classList.remove('show');
            } catch (error) {
                console.error('Erro:', error);
                showNotification('Erro ao salvar receita', 'error');
            }
        }

        async function deleteReceita(id) {
            if (!confirm('Tem certeza que deseja excluir esta receita?')) return;

            try {
                const { error } = await supabase
                    .from('receitas')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                receitas = receitas.filter(receita => receita.id !== id);
                renderTabela();
                calcularTotais();
                montarGrafico();

                // Atualizar avatar após excluir receita
                await carregarUsuario();

                showNotification('Receita excluída com sucesso');
            } catch (error) {
                console.error('Erro:', error);
                showNotification('Erro ao excluir receita', 'error');
            }
        }

        // Expor função globalmente
        window.deleteReceita = deleteReceita;

        // Formatar valores monetários
        document.getElementById('salario').addEventListener('blur', function() {
            if (this.value) this.value = parseFloat(this.value).toFixed(2);
        });

        document.getElementById('descontos').addEventListener('blur', function() {
            if (this.value) this.value = parseFloat(this.value).toFixed(2);
        });
    
