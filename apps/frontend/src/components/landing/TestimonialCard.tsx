import { Component } from 'solid-js';

type TestimonialCardProps = {
  quote: string;
  author: string;
  role: string;
  avatar: string;
};

const TestimonialCard: Component<TestimonialCardProps> = (props) => {
  return (
    <div class="group surface-panel h-full p-6 transition-all duration-300 hover:shadow-floating hover:-translate-y-1 hover:border-slate-300">
      <p class="text-sm leading-relaxed text-slate-700 transition-colors group-hover:text-slate-900">
        "{props.quote}"
      </p>
      <div class="mt-4 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-lg transition-transform group-hover:scale-110">
          {props.avatar}
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-900">{props.author}</p>
          <p class="text-xs text-slate-500">{props.role}</p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard;

