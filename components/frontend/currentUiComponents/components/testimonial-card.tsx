interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  image: string;
}

export default function TestimonialCard({
  quote,
  name,
  role,
  image,
}: TestimonialCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <div className="mr-4">
          <div className="w-12 h-12 rounded-full overflow-hidden">
            <img
              src={
                image ||
                `https://placehold.co/200x200/e2e8f0/1e293b?text=${name.charAt(
                  0
                )}`
              }
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div>
          <h4 className="font-semibold">{name}</h4>
          <p className="text-sm text-primary">{role}</p>
        </div>
      </div>
      <p className="italic text-slate-600">&quot;{quote}&quot;</p>
    </div>
  );
}
