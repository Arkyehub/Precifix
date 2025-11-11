import {
  Gauge,
  DollarSign,
  Package,
  Car,
  CreditCard,
  FileText,
  User as UserIcon,
  Settings,
  ReceiptText,
  Users,
  CalendarCheck,
  Wallet,
  Wrench,
  ShoppingCart, // Novo ícone para Vendas
  PlusCircle, // Novo ícone para Lançar Venda
  Banknote, // Novo ícone para Contas a Pagar
} from 'lucide-react';

export const navigationLinks = [
  { to: '/', icon: Gauge, label: 'Painel Principal', type: 'link' },
  { 
    label: 'Vendas', 
    icon: ShoppingCart, 
    type: 'group',
    sublinks: [
      { to: '/sales', icon: ShoppingCart, label: 'Gerenciar Vendas' },
      { to: '/sales/new', icon: PlusCircle, label: 'Lançar Venda' },
      { to: '/generate-quote', icon: FileText, label: 'Gerar Orçamento' },
    ]
  },
  { 
    label: 'Serviços', 
    icon: Wrench, 
    type: 'group',
    sublinks: [
      { to: '/products', icon: Package, label: 'Gerenciar Produtos' },
      { to: '/services', icon: Car, label: 'Gerenciar Serviços' },
    ]
  },
  { 
    label: 'Financeiro', 
    icon: Wallet, 
    type: 'group',
    sublinks: [
      { to: '/manage-costs', icon: DollarSign, label: 'Gerenciar Custos' },
      { to: '/accounts-payable', icon: Banknote, label: 'Contas a Pagar' }, // Novo link
      { to: '/billing', icon: ReceiptText, label: 'Gerenciar Faturamento' },
      { to: '/payment-methods', icon: CreditCard, label: 'Gerenciar Pagamentos' },
    ]
  },
  { to: '/agenda', icon: CalendarCheck, label: 'Agenda', type: 'link' }, // MOVIDO PARA CÁ
  { to: '/clients', icon: Users, label: 'Clientes', type: 'link' },
];

export const userDropdownLinks = [
  { to: '/profile', icon: UserIcon, label: 'Meu Perfil' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];