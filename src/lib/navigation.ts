import {
  Gauge,
  DollarSign,
  Package,
  Car,
  CreditCard,
  FileText,
  User as UserIcon,
  Settings,
  FolderOpen,
  ReceiptText,
  Users,
  CalendarCheck,
  Wallet, // Novo ícone para Financeiro
  Wrench, // Novo ícone para Serviços
} from 'lucide-react';

export const navigationLinks = [
  { to: '/', icon: Gauge, label: 'Painel Principal', type: 'link' },
  { 
    label: 'Financeiro', 
    icon: Wallet, 
    type: 'group',
    sublinks: [
      { to: '/manage-costs', icon: DollarSign, label: 'Gerenciar Custos' },
      { to: '/billing', icon: ReceiptText, label: 'Gerenciar Faturamento' },
      { to: '/payment-methods', icon: CreditCard, label: 'Gerenciar Pagamentos' },
    ]
  },
  { 
    label: 'Serviços', 
    icon: Wrench, 
    type: 'group',
    sublinks: [
      { to: '/products', icon: Package, label: 'Gerenciar Produtos' },
      { to: '/services', icon: Car, label: 'Gerenciar Serviços' },
      { to: '/agenda', icon: CalendarCheck, label: 'Agenda' },
      { to: '/generate-quote', icon: FileText, label: 'Gerar Orçamento' },
    ]
  },
  { to: '/clients', icon: Users, label: 'Clientes', type: 'link' },
  // Removido /storage-test
];

export const userDropdownLinks = [
  { to: '/profile', icon: UserIcon, label: 'Meu Perfil' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];