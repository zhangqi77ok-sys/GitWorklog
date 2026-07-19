export interface ReviewQueueReview {
  reviewId: string;
  actionId: string;
  result: string;
  comment?: string;
}

export interface ReviewQueueAction {
  actionId: string;
  actionType: string;
  status: string;
  message?: string;
  requiresReview?: boolean;
}

export interface ReviewQueueEntry {
  reviewId: string;
  actionId: string;
  result: string;
  comment?: string;
  actionTitle: string;
  actionStatus: string;
  actionMessage: string;
  requiresReview: boolean;
}

export interface ReviewQueueState {
  selectedReviewId?: string;
  items: ReviewQueueEntry[];
}

export function buildReviewQueueState(
  reviews: ReviewQueueReview[],
  actions: ReviewQueueAction[],
): ReviewQueueState {
  const items = reviews
    .map((review) => {
      const action = actions.find((candidate) => candidate.actionId === review.actionId);
      return {
        reviewId: review.reviewId,
        actionId: review.actionId,
        result: review.result,
        comment: review.comment,
        actionTitle: action ? `动作 ${action.actionType}` : "未关联动作",
        actionStatus: action?.status ?? "unknown",
        actionMessage: action?.message ?? "当前审核未找到对应动作摘要",
        requiresReview: action?.requiresReview ?? review.result === "pending",
      };
    })
    .sort((left, right) => {
      if (left.result === right.result) {
        return left.reviewId.localeCompare(right.reviewId);
      }
      return left.result === "pending" ? -1 : 1;
    });

  return {
    selectedReviewId: items[0]?.reviewId,
    items,
  };
}

export function selectReview(state: ReviewQueueState, reviewId: string): ReviewQueueState {
  if (!state.items.some((item) => item.reviewId === reviewId)) {
    return state;
  }

  return {
    ...state,
    selectedReviewId: reviewId,
  };
}
