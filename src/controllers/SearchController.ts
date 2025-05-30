import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";
import AppError from "../utils/types/errors";
import { RequestWithSession } from "../utils/types/session";
import {
  COLLECTION_PREVIEW_MEDIAS_INCLUDE,
  ENTITY_OWNER_SELECT,
  POSTS_INCLUDE,
} from "../utils/constants/queries";
import { getPaginationParameters } from "../utils/functions/shared";
import { postsSetCollectionAttachmentIsViewableProp } from "../utils/functions/sharedPrismaFunctions";

export default class SearchController {
  public searchPosts = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { query } = req.query;

    if (!query) {
      throw new AppError(422, "No query provided.", true);
    }

    const sanitizedQuery = query
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(/\s+/)
      .join(" & ");

    const { _page, _perPage, order, skip } = getPaginationParameters(req);

    const searchPosts = await PRISMA.post.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        OR: [
          // search in post content
          {
            content: {
              search: sanitizedQuery,
            },
          },
          // search in related media title
          {
            media: {
              title: {
                search: query
                  .toString()
                  .trim()
                  .replace(/[^a-zA-Z0-9 ]/g, "")
                  .split(/\s+/)
                  .join(" & "),
              },
            },
          },
        ],
        AND: [
          // privacy filters
          {
            OR: [
              // public posts
              {
                privacy: "PUBLIC",
              },
              //all friends-only posts from the current user
              {
                AND: [{ ownerId: session.userId }, { privacy: "FRIENDS_ONLY" }],
              },
              //all friends-only posts from the current user's friends
              {
                AND: [
                  { privacy: "FRIENDS_ONLY" },
                  {
                    owner: {
                      AND: [
                        {
                          followers: {
                            some: {
                              followedId: session.userId,
                            },
                          },
                        },
                        {
                          following: {
                            some: {
                              followerId: session.userId,
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      include: POSTS_INCLUDE(session.userId),
    });

    const totalItems = await PRISMA.post.count({
      where: {
        OR: [
          // search in post content
          {
            content: {
              search: sanitizedQuery,
            },
          },
          // search in related media title
          {
            media: {
              title: {
                search: query
                  .toString()
                  .trim()
                  .replace(/[^a-zA-Z0-9 ]/g, "")
                  .split(/\s+/)
                  .join(" & "),
              },
            },
          },
        ],
        AND: [
          // privacy filters
          {
            OR: [
              // public posts
              {
                privacy: "PUBLIC",
              },
              //all friends-only posts from the current user
              {
                AND: [{ ownerId: session.userId }, { privacy: "FRIENDS_ONLY" }],
              },
              //all friends-only posts from the current user's friends
              {
                AND: [
                  { privacy: "FRIENDS_ONLY" },
                  {
                    owner: {
                      AND: [
                        {
                          followers: {
                            some: {
                              followedId: session.userId,
                            },
                          },
                        },
                        {
                          following: {
                            some: {
                              followerId: session.userId,
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const totalPages = Math.ceil(totalItems / _perPage);

    const posts = await postsSetCollectionAttachmentIsViewableProp({
      currentUserId: session.userId,
      posts: searchPosts.map((post) => ({
        id: post.id,
        content: post.content,
        privacy: post.privacy,
        owner: post.owner,
        totalLikes: post._count.likes,
        totalComments: post._count.comments,
        createdAt: post.createdAt,
        isLikedByCurrentUser: post.likes
          .map((like) => like.userId)
          .includes(session.userId.toString()),
        media: post.media,
        collection: post.collection
          ? {
              id: post.collection.id,
              name: post.collection.name,
              description: post.collection.description,
              owner: post.collection.owner,
              privacy: post.collection.privacy,
              previewMedias: post.collection.collectionItems.map(
                (collectionItem) => collectionItem.media
              ),
            }
          : null,
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

  public searchUsers = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { query } = req.query;

    if (!query) {
      throw new AppError(422, "No query provided.", true);
    }

    const sanitizedQuery = query
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(/\s+/)
      .join(" & ");

    const { _page, _perPage, order, skip } = getPaginationParameters(req);

    const searchUsers = await PRISMA.user.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        OR: [
          {
            username: {
              search: sanitizedQuery,
            },
          },
          {
            handle: {
              search: sanitizedQuery,
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        handle: true,
        following: {
          where: {
            followerId: session.userId,
          },
        },
      },
    });

    const totalItems = await PRISMA.user.count({
      where: {
        OR: [
          {
            username: {
              search: sanitizedQuery,
            },
          },
          {
            handle: {
              search: sanitizedQuery,
            },
          },
        ],
      },
    });
    const totalPages = Math.ceil(totalItems / _perPage);

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: searchUsers.map((user) => ({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        handle: user.handle,
        isFollowedByCurrentUser: user.following.length === 0 ? false : true,
      })),
    });
  });

  public searchCollections = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { query } = req.query;

    if (!query) {
      throw new AppError(422, "No query provided.", true);
    }

    const sanitizedQuery = query
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(/\s+/)
      .join(" & ");

    const { _page, _perPage, order, skip } = getPaginationParameters(req);

    //retrieve collections that have privacy PUBLIC and FRIENDS_ONLY
    const searchCollections = await PRISMA.collection.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        name: {
          search: sanitizedQuery,
        },
        OR: [
          //all public collections
          {
            privacy: "PUBLIC",
          },

          //all friends-only collections from the current user's friends
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
      include: {
        collectionItems: COLLECTION_PREVIEW_MEDIAS_INCLUDE,
        owner: ENTITY_OWNER_SELECT,
      },
    });

    const totalItems = await PRISMA.collection.count({
      where: {
        name: {
          search: sanitizedQuery,
        },
        OR: [
          //all public collections
          {
            privacy: "PUBLIC",
          },

          //all friends-only collections from the current user's friends
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

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: searchCollections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        photo: collection.photo,
        owner: collection.owner,
        privacy: collection.privacy,
        previewMedias: collection.collectionItems.map(
          (collectionItem) => collectionItem.media
        ),
      })),
    });
  });
}
