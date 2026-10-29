import type { PipelineStage } from 'mongoose';
/** Cumulative integer recognition puts rounding remainder on the last service day. */
export function accrualStages(from: string, to: string): PipelineStage[] {
  return [
    {
      $set: {
        _serviceStart: { $dateFromString: { dateString: { $ifNull: ['$serviceStart', '$date'] } } },
        _serviceEnd: { $dateFromString: { dateString: { $ifNull: ['$serviceEnd', '$date'] } } },
      },
    },
    {
      $set: {
        _serviceDays: {
          $add: [
            1,
            { $dateDiff: { startDate: '$_serviceStart', endDate: '$_serviceEnd', unit: 'day' } },
          ],
        },
        _beforeDays: {
          $max: [
            0,
            {
              $dateDiff: {
                startDate: '$_serviceStart',
                endDate: new Date(`${from}T00:00:00Z`),
                unit: 'day',
              },
            },
          ],
        },
        _throughDays: {
          $max: [
            0,
            {
              $add: [
                1,
                {
                  $dateDiff: {
                    startDate: '$_serviceStart',
                    endDate: new Date(`${to}T00:00:00Z`),
                    unit: 'day',
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      $set: {
        earnedPaise: {
          $subtract: [
            {
              $floor: {
                $divide: [
                  { $multiply: ['$totalPaise', { $min: ['$_throughDays', '$_serviceDays'] }] },
                  '$_serviceDays',
                ],
              },
            },
            {
              $floor: {
                $divide: [
                  { $multiply: ['$totalPaise', { $min: ['$_beforeDays', '$_serviceDays'] }] },
                  '$_serviceDays',
                ],
              },
            },
          ],
        },
      },
    },
    { $unset: ['_serviceStart', '_serviceEnd', '_serviceDays', '_beforeDays', '_throughDays'] },
  ];
}
