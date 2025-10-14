import { toast } from 'solid-sonner';

type ToastOptions = {
  description?: string;
  duration?: number;
};

export const notifySuccess = (title: string, options: ToastOptions = {}) =>
  toast.success(title, options);

export const notifyError = (title: string, options: ToastOptions = {}) =>
  toast.error(title, options);

export const notifyInfo = (title: string, options: ToastOptions = {}) =>
  toast(title, options);
