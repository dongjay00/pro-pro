const { statusCode, responseMessage } = require('../globals');
const { resFormatter } = require('../utils');
const asyncHandler = require('../utils/asyncHandler');
const postService = require('../services/postService');

const { ValidationError } = require('../utils/errors/commonError');
const {
  CategoryTypeError,
  StackNotLowerCaseError,
} = require('../utils/errors/postError');

// 게시글 목록
exports.getPost = asyncHandler(async (req, res, next) => {
  const category = req.query.category;
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.perPage || 10);
  const skipSize = (page - 1) * perPage;

  // 카테고리 체크
  if (category !== 'project' && category !== 'study')
    throw new CategoryTypeError();

  const posts = await postService.getPost(category, skipSize, perPage);

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.SUCCESS, posts));
});

// 게시글 상세페이지
exports.getPostDetail = asyncHandler(async (req, res, next) => {
  const { postId } = req.params;

  // 게시글이 존재하지 않을 때
  await postService.isExistPost(postId);

  // 조회수 증가
  await postService.increaseView(postId);

  // 상세페이지 정보 가져오기
  const posts = await postService.getPostDetail(postId);

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.SUCCESS, posts));
});

// 게시글 생성
exports.createPost = asyncHandler(async (req, res, next) => {
  const { userId } = req.decoded;
  const {
    category,
    title,
    content,
    stacks,
    capacity,
    region: { lat, lng, address, sido },
    executionPeriod,
    registerDeadline,
  } = req.body;

  // 빈 값 체크
  if (
    !category ||
    !title ||
    !content ||
    !capacity ||
    !executionPeriod ||
    !registerDeadline
  )
    throw new ValidationError();

  // 카테고리 체크
  if (category !== 'project' && category !== 'study')
    throw new CategoryTypeError();

  // 스택 소문자로만 이루어진 형식인지 체크
  stacks.forEach(stack => {
    if (!/^[a-z]+$/.test(stack)) throw new StackNotLowerCaseError();
  });

  const [startDate, endDate] = executionPeriod;

  // 빈 값 체크
  if (!startDate || !endDate) throw new ValidationError();

  const location = {
    type: 'Point',
    coordinates: [lat, lng],
  };

  await postService.createPost({
    author: { _id: userId },
    category,
    title,
    content,
    stacks,
    capacity,
    location,
    address,
    sido,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    registerDeadline: new Date(registerDeadline),
  });

  return res
    .status(statusCode.CREATED)
    .send(resFormatter.success(responseMessage.POST_CREATED, {}));
});

// 게시글 수정
exports.updatePost = asyncHandler(async (req, res, next) => {
  const { userId } = req.decoded;
  const { postId } = req.params;
  const {
    category,
    title,
    content,
    stacks,
    capacity,
    region: { lat, lng, address, sido },
    executionPeriod,
    registerDeadline,
  } = req.body;

  // 빈 값 체크
  if (
    !category ||
    !title ||
    !content ||
    !capacity ||
    !executionPeriod ||
    !registerDeadline
  )
    throw new ValidationError();

  // 카테고리 체크
  if (category !== 'project' && category !== 'study')
    throw new CategoryTypeError();

  // 스택 소문자로만 이루어진 형식인지 체크
  stacks.forEach(stack => {
    if (!/^[a-z]+$/.test(stack)) throw new StackNotLowerCaseError();
  });

  const [startDate, endDate] = executionPeriod;

  // 빈 값 체크
  if (!startDate || !endDate) throw new ValidationError();

  const location = {
    type: 'Point',
    coordinates: [lat, lng],
  };

  // 게시글이 존재하지 않을 때
  await postService.isExistPost(postId);

  // 권한 확인
  await postService.authCheck(userId, postId);

  await postService.updatePost(postId, {
    category,
    title,
    content,
    stacks,
    capacity,
    location,
    address,
    sido,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    registerDeadline: new Date(registerDeadline),
  });

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.POST_UPDATED, {}));
});

// 게시글 삭제
exports.deletePost = asyncHandler(async (req, res, next) => {
  const { userId } = req.decoded;
  const { postId } = req.params;

  // 게시글이 존재하지 않을 때
  await postService.isExistPost(postId);

  // 권한 확인
  await postService.authCheck(userId, postId);

  await postService.deletePost(postId);

  return res
    .status(statusCode.OK)
    .send(resFormatter.success(responseMessage.POST_DELETED, {}));
});
