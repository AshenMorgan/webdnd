"use client";

import Link from "next/link";

export default function ScenarioListView({
  scenarios,
}: {
  scenarios: { id: string; title: string }[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
      {scenarios.length === 0 ? (
        <p className="col-span-full text-center text-gray-400 text-xl">
          无可用场景
        </p>
      ) : (
        scenarios.map((s) => (
          <Link
            key={s.id}
            href={`/scenarios/${s.id}`}
            className="p-6 border border-gray-700 rounded-xl hover:shadow-2xl hover:border-purple-500 transition duration-300 transform hover:-translate-y-1 bg-gray-800 flex flex-col justify-between"
          >
            <h2 className="text-xl font-semibold mb-2 text-white group-hover:text-purple-300">
              {s.title}
            </h2>
            <p className="text-sm text-gray-400">点击选择此场景</p>
          </Link>
        ))
      )}
    </div>
  );
}
