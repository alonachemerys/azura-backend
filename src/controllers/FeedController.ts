import { Response, Request } from "express";
import PRISMA from "../utils/constants/prismaInstance";
import { asyncHandler } from "../middleware/asyncHandler";
import { RequestWithSession } from "../utils/types/session";
import { POSTS_INCLUDE } from "../utils/constants/queries";
import { getPaginationParameters } from "../utils/functions/shared";
import { postsSetCollectionAttachmentIsViewableProp } from "../utils/functions/sharedPrismaFunctions";

export default class FeedController {
  public getForYouPosts = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;

    const { _page, _perPage, order, skip } = getPaginationParameters(req);

    const forYouPosts = await PRISMA.post.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        OR: [
          //all public posts
          {
            privacy: "PUBLIC",
          },

          //all friends-only posts from the current user
          {
            ownerId: session.userId,
            privacy: "FRIENDS_ONLY",
          },

          //all friends-only posts from the current user's friends
          {
            privacy: "FRIENDS_ONLY",
            owner: {
              followers: {
                some: {
                  followedId: session.userId,
                },
              },
              following: {
                some: {
                  followerId: session.userId,
                },
              },
            },
          },
        ],
      },
      include: POSTS_INCLUDE(session.userId),
    });

    const totalItems = await PRISMA.post.count({
      where: {
        OR: [
          //all public posts
          {
            privacy: "PUBLIC",
          },

          //all friends-only posts from the current user
          {
            ownerId: session.userId,
            privacy: "FRIENDS_ONLY",
          },

          //all friends-only posts from the current user's friends
          {
            privacy: "FRIENDS_ONLY",
            owner: {
              followers: {
                some: {
                  followedId: session.userId,
                },
              },
              following: {
                some: {
                  followerId: session.userId,
                },
              },
            },
          },
        ],
      },
    });
    const totalPages = Math.ceil(totalItems / _perPage);

    const posts = await postsSetCollectionAttachmentIsViewableProp({
      currentUserId: session.userId,
      posts: forYouPosts.map((post) => ({
        id: post.id,
        content: post.content,
        privacy: post.privacy,
        owner: post.owner,
        totalLikes: post._count.likes,
        totalComments: post._count.comments,
        isLikedByCurrentUser: post.likes
          .map((like) => like.userId)
          .includes(session.userId.toString()),
        media: post.media,
        collection: post.collection
          ? {
              id: post.collection.id,
              photo: post.collection.photo,
              name: post.collection.name,
              description: post.collection.description,
              privacy: post.collection.privacy,
              owner: post.collection.owner,
              previewMedias: post.collection.collectionItems.map(
                (collectionItem) => collectionItem.media
              ),
            }
          : null,
        createdAt: post.createdAt,
      })),
    });

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: posts,
    });
  });

  public getFollowingPosts = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;

    const { _page, _perPage, order, skip } = getPaginationParameters(req);

    const followingPosts = await PRISMA.post.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        OR: [
          //all friends-only posts from the current user's friends
          {
            privacy: "FRIENDS_ONLY",
            owner: {
              followers: {
                some: {
                  followedId: session.userId,
                },
              },
              following: {
                some: {
                  followerId: session.userId,
                },
              },
            },
          },
          //all public posts from users that the current user follow
          //this includes all public posts from the current user's friends
          {
            privacy: "PUBLIC",
            owner: {
              following: {
                some: {
                  followerId: session.userId,
                },
              },
            },
          },
        ],
      },
      include: POSTS_INCLUDE(session.userId),
    });

    const totalItems = await PRISMA.post.count({
      where: {
        OR: [
          //all friends-only posts from the current user's friends
          {
            privacy: "FRIENDS_ONLY",
            owner: {
              followers: {
                some: {
                  followedId: session.userId,
                },
              },
              following: {
                some: {
                  followerId: session.userId,
                },
              },
            },
          },
          //all public posts from users that the current user follow
          //this includes all public posts from the current user's friends
          {
            privacy: "PUBLIC",
            owner: {
              following: {
                some: {
                  followerId: session.userId,
                },
              },
            },
          },
        ],
      },
    });

    const totalPages = Math.ceil(totalItems / _perPage);

    const posts = await postsSetCollectionAttachmentIsViewableProp({
      currentUserId: session.userId,
      posts: followingPosts.map((post) => ({
        id: post.id,
        content: post.content,
        privacy: post.privacy,
        owner: post.owner,
        totalLikes: post._count.likes,
        totalComments: post._count.comments,
        isLikedByCurrentUser: post.likes
          .map((like) => like.userId)
          .includes(session.userId.toString()),
        media: post.media,
        collection: post.collection
          ? {
              id: post.collection.id,
              photo: post.collection.photo,
              name: post.collection.name,
              description: post.collection.description,
              owner: post.collection.owner,
              privacy: post.collection.privacy,
              previewMedias: post.collection.collectionItems.map(
                (collectionItem) => collectionItem.media
              ),
            }
          : null,
        createdAt: post.createdAt,
      })),
    });

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: posts,
    });
  });
}
