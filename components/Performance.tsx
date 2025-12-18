
import React, { useEffect, useRef } from 'react';
import { PerformanceRecord } from '../types';

declare const Chart: any; // Using Chart.js from CDN

interface PerformanceProps {
  history: PerformanceRecord[];
  onBack: () => void;
}

const Performance: React.FC<PerformanceProps> = ({ history, onBack }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (history.length > 1 && chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        const labels = history.map((_, index) => `Session ${index + 1}`);
        const accuracyData = history.map(r => (r.accuracy !== undefined ? r.accuracy * 100 : null));
        const audioData = history.map(r => r.settings.audioThreshold);
        const colorData = history.map(r => r.settings.colorThreshold);
        const shapeData = history.map(r => r.settings.shapeThreshold);

        chartInstanceRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Accuracy (%)',
                data: accuracyData,
                borderColor: 'var(--color-primary)',
                backgroundColor: 'hsla(188, 80%, 52%, 0.2)',
                yAxisID: 'yAccuracy',
                tension: 0.1,
              },
              {
                label: 'Audio Δ',
                data: audioData,
                borderColor: 'var(--color-button-audio)',
                yAxisID: 'yThresholds',
                hidden: true,
              },
              {
                label: 'Color Δ',
                data: colorData,
                borderColor: 'var(--color-button-color)',
                yAxisID: 'yThresholds',
                hidden: true,
              },
              {
                label: 'Shape Δ',
                data: shapeData,
                borderColor: 'var(--color-button-shape)',
                yAxisID: 'yThresholds',
                hidden: true,
              },
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              yAccuracy: {
                type: 'linear',
                display: true,
                position: 'left',
                min: 0,
                max: 100,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: 'var(--color-text-muted)' }
              },
              yThresholds: {
                type: 'logarithmic',
                display: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: 'var(--color-text-muted)' }
              },
              x: {
                 grid: { color: 'rgba(255, 255, 255, 0.1)' },
                 ticks: { color: 'var(--color-text-muted)' }
              }
            },
            plugins: {
              legend: { labels: { color: 'var(--color-text-base)' } },
              tooltip: {
                backgroundColor: 'var(--color-bg-surface)',
                titleColor: 'var(--color-text-base)',
                bodyColor: 'var(--color-text-muted)',
              }
            }
          }
        });
      }
    }
     return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [history]);

  return (
    <div className="p-4 sm:p-8 bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl text-gray-200">
      <h2 className="text-3xl font-bold mb-6 text-primary text-center">Performance History</h2>
      
      {history.length > 1 ? (
        <div className="mb-8 h-96 bg-gray-900/50 p-4 rounded-lg">
          <canvas ref={chartRef}></canvas>
        </div>
      ) : (
        history.length > 0 && <p className="text-center text-gray-400 py-4">Complete another session to see a performance graph.</p>
      )}

      <div className="overflow-x-auto">
        {history.length > 0 ? (
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="bg-gray-700 text-gray-300">
                <th className="p-3">Date</th>
                <th className="p-3">N-Level</th>
                <th className="p-3">Grid Size</th>
                <th className="p-3">Audio Δ</th>
                <th className="p-3">Color Δ</th>
                <th className="p-3">Shape Δ</th>
                <th className="p-3">Accuracy</th>
                <th className="p-3">Hits</th>
                <th className="p-3">Misses</th>
                <th className="p-3">Audio FA</th>
                <th className="p-3">Spatial FA</th>
                <th className="p-3">Color FA</th>
                <th className="p-3">Shape FA</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((record, index) => (
                <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="p-3 text-sm">{new Date(record.date).toLocaleString()}</td>
                  <td className="p-3 text-center">{record.settings.nLevel}</td>
                  <td className="p-3 text-center">{`${record.settings.gridRows}x${record.settings.gridCols}`}</td>
                  <td className="p-3 text-center">{record.settings.audioThreshold.toFixed(2)}</td>
                   <td className="p-3 text-center">{record.settings.colorThreshold.toFixed(2)}</td>
                  <td className="p-3 text-center">{record.settings.shapeThreshold.toFixed(3)}</td>
                  <td className={`p-3 text-center font-bold ${record.accuracy && record.accuracy > 0.75 ? 'text-accent-success' : 'text-gray-300'}`}>
                    {record.accuracy !== undefined ? `${(record.accuracy * 100).toFixed(0)}%` : 'N/A'}
                  </td>
                  <td className="p-3 text-center text-accent-success">{record.score.hits}</td>
                  <td className="p-3 text-center text-accent-error">{record.score.misses}</td>
                  <td className="p-3 text-center text-accent-error">{record.score.audioFalseAlarms}</td>
                  <td className="p-3 text-center text-accent-error">{record.score.spatialFalseAlarms}</td>
                  <td className="p-3 text-center text-accent-error">{record.score.colorFalseAlarms}</td>
                  <td className="p-3 text-center text-accent-error">{record.score.shapeFalseAlarms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-400 py-8">No performance data yet. Complete a session to see your results here.</p>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <button onClick={onBack} className="px-8 py-3 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-lg transition-colors">Back to Menu</button>
      </div>
    </div>
  );
};

export default Performance;