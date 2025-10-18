import {
  LayoutDashboard, // Alterado de Calculator para LayoutDashboard
  DollarSign,
  Package,
  Car,
  CreditCard,
  FileText,
  User as UserIcon,
  Settings,
} from 'lucide-react';

export const navigationLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Painel Principal' }, // Alterado nome e ícone
  { to: '/manage-costs', icon: DollarSign, label: 'Gerenciar Custos' },
  { to: '/products', icon: Package, label: 'Gerenciar Produtos' },
  { to: '/services', icon: Car, label: 'Gerenciar Serviços' },
  { to: '/payment-methods', icon: CreditCard, label: 'Gerenciar Pagamentos' },
  { to: '/generate-quote', icon: FileText, label: 'Gerar Orçamento' },
];

export const userDropdownLinks = [
  { to: '/profile', icon: UserIcon, label: 'Meu Perfil' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
  // Adicione outros links do dropdown do usuário aqui, se houver
];