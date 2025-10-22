import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { CollapsibleSection } from './CollapsibleSection'; // O componente a ser arrastado
import { cn } from '@/lib/utils'; // Para Tailwind classes

interface DraggableCollapsibleSectionProps {
  id: string; // ID único para o item arrastável (mesmo que preferenceKey)
  index: number;
  moveSection: (dragIndex: number, hoverIndex: number) => void;
  title: string;
  preferenceKey: string;
  defaultOpen?: boolean;
  icon: React.ElementType;
  children: React.ReactNode;
}

interface DragItem {
  id: string;
  index: number;
  type: string;
}

const ItemTypes = {
  SECTION: 'section',
};

export const DraggableCollapsibleSection = ({
  id,
  index,
  moveSection,
  title,
  preferenceKey,
  defaultOpen,
  icon,
  children,
}: DraggableCollapsibleSectionProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop<DragItem, void, { handlerId: string | symbol | null }>({
    accept: ItemTypes.SECTION,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Não substitua itens por eles mesmos
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine o retângulo na tela
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Obtenha o meio vertical
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine a posição do mouse
      const clientOffset = monitor.getClientOffset();

      // Obtenha os pixels até o topo
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

      // Apenas execute a movimentação quando o mouse tiver cruzado metade da altura do item
      // Ao arrastar para baixo, mova apenas quando o cursor estiver abaixo de 50%
      // Ao arrastar para cima, mova apenas quando o cursor estiver acima de 50%

      // Arrastando para baixo
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Arrastando para cima
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Hora de realmente executar a ação
      moveSection(dragIndex, hoverIndex);

      // Nota: estamos mutando o item do monitor aqui!
      // Geralmente é melhor evitar mutações, mas é bom aqui por uma questão de desempenho
      // para evitar buscas de índice caras.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.SECTION,
    item: () => {
      return { id, index };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const opacity = isDragging ? 0.4 : 1;
  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity }} data-handler-id={handlerId} className="cursor-grab">
      <CollapsibleSection
        title={title}
        preferenceKey={preferenceKey}
        defaultOpen={defaultOpen}
        icon={icon}
      >
        {children}
      </CollapsibleSection>
    </div>
  );
};