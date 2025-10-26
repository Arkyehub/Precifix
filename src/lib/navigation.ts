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
  Users, // Importar Users
} from 'lucide-react';

export const navigationLinks = [
  { to: '/', icon: Gauge, label: 'Painel Principal' },
  { to: '/manage-costs', icon: DollarSign, label: 'Gerenciar Custos' },
  { to: '/billing', icon: ReceiptText, label: 'Gerenciar Faturamento' },
  { to: '/products', icon: Package, label: 'Gerenciar Produtos' },
  { to: '/services', icon: Car, label: 'Gerenciar Serviços' },
  { to: '/payment-methods', icon: CreditCard, label: 'Gerenciar Pagamentos' },
  { to: '/clients', icon: Users, label: 'Gerenciar Clientes' }, // Novo link
  { to: '/generate-quote', icon: FileText, label: 'Gerar Orçamento' },
  { to: '/storage-test', icon: FolderOpen, label: 'Testar Storage' },
];

export const userDropdownLinks = [
  { to: '/profile', icon: UserIcon, label: 'Meu Perfil' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];