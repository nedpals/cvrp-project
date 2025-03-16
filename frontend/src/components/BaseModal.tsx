import { Dialog } from '@headlessui/react';
import { createContext, useContext } from 'react';
import { cn } from '../utils/utils';

const ModalContext = createContext(0);

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '6xl';
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '6xl': 'max-w-6xl'
};

export function ModalTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return <Dialog.Title className={cn("text-lg font-medium", className)}>{children}</Dialog.Title>;
}

export function ModalContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("p-4", className)}>{children}</div>;
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("flex gap-2 justify-end p-4 border-t border-gray-100", className)}>{children}</div>;
}

export function ModalHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("px-4 py-3 border-b border-gray-100 flex items-center justify-between", className)}>{children}</div>;
}

export default function BaseModal({
    isOpen,
    onClose,
    children,
    size = 'md'
}: BaseModalProps) {
    const parentZIndex = useContext(ModalContext);
    const currentZIndex = parentZIndex + 10;

    return (
        <Dialog 
            open={isOpen} 
            onClose={onClose} 
            className={"relative"}
            style={{ zIndex: currentZIndex }}
        >
            <div className={cn("fixed inset-0 bg-black/30")} aria-hidden="true" />
            
            <div className={cn("fixed inset-0 flex items-center justify-center p-4 overflow-y-auto")}>
                <Dialog.Panel className={cn("w-full bg-white rounded-xl shadow-lg", sizeClasses[size])}>
                    <ModalContext.Provider value={currentZIndex}>
                        {children}
                    </ModalContext.Provider>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
