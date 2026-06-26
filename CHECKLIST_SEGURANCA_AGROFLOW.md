# Checklist de Seguranca Autorizada - AgroFlow

Este documento organiza uma validacao de seguranca autorizada do sistema AgroFlow.

Sistema alvo:

- URL: https://agroflow-sistema.vercel.app
- Stack: React/Vite, Supabase Auth, Supabase/PostgreSQL, Vercel
- Escopo: somente o app AgroFlow e o Supabase vinculado ao AgroFlow

Importante: nao executar testes destrutivos, nao apagar dados reais e nao testar outros projetos.

## 1. Autorizacao

| Item | Status | Evidencia | Observacoes |
| --- | --- | --- | --- |
| Autorizacao formal do responsavel pelo sistema | Pendente |  |  |
| Escopo definido: somente AgroFlow | Pendente |  |  |
| URL autorizada: https://agroflow-sistema.vercel.app | Pendente |  |  |
| Contas de teste autorizadas | Pendente |  |  |
| Limites do teste definidos | Pendente |  |  |
| Processo de parada emergencial definido | Pendente |  |  |

Limites recomendados:

- Nao excluir dados reais.
- Nao alterar configuracoes de producao sem aprovacao.
- Nao executar carga pesada ou automacao agressiva.
- Nao testar dominios, repositorios ou projetos fora do AgroFlow.
- Interromper imediatamente se o sistema apresentar instabilidade.

Contatos:

| Papel | Nome | Contato |
| --- | --- | --- |
| Responsavel pelo sistema |  |  |
| Admin AgroFlow |  |  |
| Responsavel tecnico |  |  |

## 2. Preparacao

| Item | Status | Evidencia | Observacoes |
| --- | --- | --- | --- |
| Conta Admin disponivel para teste | Pendente |  |  |
| Conta Gestor criada | Pendente |  |  |
| Conta Operador criada | Pendente |  |  |
| Conta Visualizador criada | Pendente |  |  |
| Dados de teste criados | Pendente |  |  |
| Backup do banco realizado antes dos testes | Pendente |  |  |
| Local para salvar evidencias definido | Pendente |  |  |

Dados de teste recomendados:

| Tipo | Nome sugerido | Status |
| --- | --- | --- |
| Fornecedor | FORNECEDOR TESTE SEGURANCA | Pendente |
| Produto | PRODUTO TESTE SEGURANCA | Pendente |
| Fabrica | FABRICA TESTE SEGURANCA | Pendente |
| Contrato | CT-SEG-001 | Pendente |
| Nota Fiscal | NF-SEG-001 | Pendente |
| Frete | CTE-SEG-001 | Pendente |
| Documento PDF | documento-teste-seguranca.pdf | Pendente |

## 3. Descoberta

### Rotas e telas

| Tela/Rota | Publica ou privada | Perfil minimo esperado | Status | Evidencia |
| --- | --- | --- | --- | --- |
| /login | Publica | Sem login | Pendente |  |
| / | Privada | Visualizar dashboard | Pendente |  |
| /fornecedores | Privada | Permissao fornecedores | Pendente |  |
| /fabricas | Privada | Permissao fabricas | Pendente |  |
| /produtos | Privada | Permissao produtos | Pendente |  |
| /contratos | Privada | Permissao contratos | Pendente |  |
| /notas-fiscais | Privada | Permissao notas fiscais | Pendente |  |
| /balancas | Privada | Permissao balancas | Pendente |  |
| /frete | Privada | Permissao fretes | Pendente |  |
| /documentos | Privada | Permissao documentos | Pendente |  |
| /rel-financeiro | Privada | Permissao financeiro | Pendente |  |
| /backup | Privada | Permissao backup | Pendente |  |
| /admin/acessos | Privada | Admin | Pendente |  |
| /admin/auditoria | Privada | Admin | Pendente |  |

### Dados sensiveis

| Dado | Onde aparece | Risco | Status |
| --- | --- | --- | --- |
| Nome de fornecedores | Fornecedores, contratos, notas, dashboard | Comercial | Pendente |
| CNPJ de fornecedores | Fornecedores, XML, recebimentos | Dados empresariais | Pendente |
| Contratos e valores | Contratos, financeiro | Financeiro | Pendente |
| Notas fiscais | Notas fiscais, XML | Fiscal/financeiro | Pendente |
| Fretes e CT-e | Frete, financeiro | Operacional | Pendente |
| PDFs anexados | Documentos | Documental | Pendente |
| Usuarios e perfis | Usuarios e permissoes | Controle de acesso | Pendente |

## 4. Testes

### 4.1 Autenticacao

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Acessar dashboard sem login | Redireciona para login | Pendente |  |  |
| Login com credenciais validas | Entra no sistema | Pendente |  |  |
| Login com senha errada | Bloqueia e mostra erro claro | Pendente |  |  |
| Logout | Encerra sessao e volta ao login | Pendente |  |  |
| Voltar no navegador apos logout | Nao deve exibir dados privados | Pendente |  |  |
| Recuperacao de senha | Fluxo funciona sem expor senha | Pendente |  |  |

### 4.2 Autorizacao e permissoes

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Operador acessar /admin/acessos | Acesso negado | Pendente |  |  |
| Visualizador tentar cadastrar fornecedor | Botao/formulario bloqueado | Pendente |  |  |
| Visualizador tentar editar produto | Acao bloqueada | Pendente |  |  |
| Usuario sem permissao acessar rota direta | Acesso negado | Pendente |  |  |
| Admin acessar todas as telas | Acesso liberado | Pendente |  |  |
| Alterar ID em URL/request | RLS deve bloquear acesso indevido | Pendente |  |  |

### 4.3 Validacao de entrada

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Cadastrar fornecedor sem nome | Bloqueia campo obrigatorio | Pendente |  |  |
| Cadastrar fornecedor com mesmo nome | Bloqueia duplicidade | Pendente |  |  |
| Cadastrar fornecedor com mesmo CNPJ | Bloqueia duplicidade | Pendente |  |  |
| Cadastrar produto com mesmo nome | Bloqueia duplicidade | Pendente |  |  |
| Importar XML invalido em NF | Mostra erro em portugues | Pendente |  |  |
| Importar XML repetido | Bloqueia duplicidade | Pendente |  |  |
| Upload de arquivo nao PDF em Documentos | Bloqueia arquivo invalido | Pendente |  |  |

### 4.4 Sessao

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Recarregar pagina logado | Mantem sessao correta | Pendente |  |  |
| Abrir outra aba logado | Mantem mesmo usuario correto | Pendente |  |  |
| Login com outro usuario em navegador separado | Nao mistura sessoes | Pendente |  |  |
| Sessao expirada | Redireciona para login | Pendente |  |  |

### 4.5 Regras de negocio

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Nota fiscal atualiza saldo do contrato | Saldo recalculado | Pendente |  |  |
| Exclusao de nota recalcula contrato | Saldo recalculado | Pendente |  |  |
| Frete vinculado entra no financeiro | Custo medio atualizado | Pendente |  |  |
| Contrato vencido aparece como alerta | Status correto | Pendente |  |  |
| Contrato vencendo em 30 dias aparece no dashboard | Alerta correto | Pendente |  |  |

### 4.6 APIs e backend

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Chamar API admin sem login | Bloqueia | Pendente |  |  |
| Chamar API admin com usuario comum | Bloqueia | Pendente |  |  |
| Endpoint antigo /api/aprovar-acesso por token | Nao aprova usuario | Pendente |  |  |
| Service role nao aparece no frontend | Nao exposta | Pendente |  |  |
| Respostas de erro nao vazam segredo | Mensagem segura | Pendente |  |  |

### 4.7 Arquivos

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Upload PDF valido | Salva e abre corretamente | Pendente |  |  |
| Upload arquivo invalido | Bloqueia | Pendente |  |  |
| Abrir PDF de outro usuario/empresa por URL | RLS/storage bloqueia se nao autorizado | Pendente |  |  |
| Excluir documento | Remove registro e arquivo | Pendente |  |  |

### 4.8 Configuracao e infraestrutura

| Teste | Resultado esperado | Status | Evidencia | Observacoes |
| --- | --- | --- | --- | --- |
| Variaveis NEXT_PUBLIC/VITE apenas publicas | Sem secrets expostos | Pendente |  |  |
| SUPABASE_SERVICE_ROLE_KEY somente backend/Vercel | Nao exposta no frontend | Pendente |  |  |
| RLS ativo nas tabelas principais | Ativo | Pendente |  |  |
| Policies por empresa_id | Ativas | Pendente |  |  |
| Logs Vercel sem dados sensiveis | Sem senha/token/secrets | Pendente |  |  |
| Supabase Auth URLs corretas | Dominio correto | Pendente |  |  |

## 5. Validacao

Para cada falha encontrada, preencher:

| Campo | Descricao |
| --- | --- |
| ID da falha | SEC-001 |
| Titulo |  |
| Severidade | Critica, Alta, Media, Baixa |
| Perfil usado | Admin, Gestor, Operador, Visualizador, sem login |
| Tela/API afetada |  |
| Passos para reproduzir |  |
| Resultado esperado |  |
| Resultado obtido |  |
| Evidencia | Print, log, request, resposta |
| Impacto |  |
| Causa provavel |  |
| Correcao recomendada |  |
| Status | Aberta, Corrigida, Retestada |

Classificacao sugerida:

- Critica: acesso sem login, vazamento de dados sensiveis, exposicao de chave secreta.
- Alta: usuario comum acessa admin, acesso entre empresas, exclusao indevida.
- Media: bypass de permissao em funcao especifica, upload inadequado, regra de negocio falha.
- Baixa: mensagens confusas, validacoes incompletas sem impacto direto.

## 6. Relatorio

### Resumo executivo

| Item | Resultado |
| --- | --- |
| Data do teste |  |
| Responsavel |  |
| Ambiente | Producao / Preview / Local |
| Total de testes |  |
| Aprovados |  |
| Reprovados |  |
| Falhas criticas |  |
| Falhas altas |  |
| Status final | Aprovado / Nao aprovado |

### Achados tecnicos

| ID | Severidade | Titulo | Status | Correcao |
| --- | --- | --- | --- | --- |
| SEC-001 |  |  |  |  |

## 7. Reteste

| ID da falha | Correcao aplicada | Teste repetido | Resultado | Evidencia | Risco residual |
| --- | --- | --- | --- | --- | --- |
| SEC-001 |  |  | Pendente |  |  |

## Checklist final de aprovacao

| Item | Status | Observacoes |
| --- | --- | --- |
| Todas as rotas privadas protegidas | Pendente |  |
| RLS ativo e validado | Pendente |  |
| Perfis respeitam permissoes | Pendente |  |
| Dados entre empresas isolados | Pendente |  |
| Service role nao exposta | Pendente |  |
| Uploads seguros | Pendente |  |
| Logs sem dados sensiveis | Pendente |  |
| Backup/exportacao protegido por permissao | Pendente |  |
| Erros em portugues e sem detalhes sensiveis | Pendente |  |
| Reteste concluido | Pendente |  |

Status final:

- [ ] Aprovado
- [ ] Nao aprovado
- [ ] Aprovado com risco residual documentado
