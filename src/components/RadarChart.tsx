'use client';

import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

const DIM_LABELS: Record<string, string> = {
  starCompleteness: 'STAR',
  quantification: '量化',
  logicClarity: '逻辑',
  technicalDepth: '深度',
  communication: '表达',
};

export default function RadarChart({
  data,
}: {
  data: Record<string, number>;
}) {
  const chartData = Object.entries(data)
    .filter(([k]) => DIM_LABELS[k])
    .map(([k, v]) => ({
      dimension: DIM_LABELS[k] || k,
      score: v,
    }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer>
        <RechartsRadar data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} />
          <Radar
            name="得分"
            dataKey="score"
            stroke="#2563eb"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}
